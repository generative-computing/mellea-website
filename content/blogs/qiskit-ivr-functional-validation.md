---
title: "From Linting to Tests: Doubling Functional Correctness in Qiskit IVR"
date: "2026-05-27"
author: "Alex Bozarth"
excerpt: "Wiring functional tests into Mellea's Instruct-Validate-Repair loop nearly doubled functional correctness on the Qiskit Human Eval benchmark, on top of what static validation already provided."
tags: ["qiskit", "IVR", "validation", "benchmark", "LLM", "code-generation"]
---

In our [previous post](/blogs/qiskit-ivr-code-validation/) we showed how Mellea's
Instruct-Validate-Repair (IVR) pattern, paired with `flake8-qiskit-migration`,
catches deprecated Qiskit APIs in LLM-generated code automatically. With a
Qiskit-specialized model that piece works well: across 302 benchmark runs, the
linter accepted the model's output 100% of the time. Static validation does
real work, and the repair loop is a reliable safety net for migration rules.

That left an obvious next question: a linter can tell us the imports are
modern and the API names exist, but it cannot tell us whether the code does
what was asked. What happens when the validator inside the IVR loop is a
functional test instead of a static check?

We had a clean way to answer that. The
[Qiskit Human Eval (QHE)](https://github.com/qiskit-community/qiskit-human-eval)
dataset ships a `check()` function with each problem: a small unit test that
runs the generated code and asserts on its output. We wired `check()` into
Mellea's IVR loop as a second `Requirement`, alongside the existing QKT
linter, and reran the benchmark. Same model, same prompts, same repair
budget, two validators instead of one.

Functional correctness on the same benchmark went from **27.8%**
to **50.3%** — a +22.5pp jump on a benchmark the model was already saturating
from a linting standpoint. This post is about how that integration was wired
together, why dynamic feedback unlocked it, and what it does and doesn't
generalize to.

## What "linter pass" was and wasn't telling us

The first post left one finding implicit that's worth pulling out, because it
sets up everything below. The Qiskit-specialized model used in our benchmark
(`hf.co/Qiskit/mistral-small-3.2-24b-qiskit-GGUF`) passed the QKT linter on
100% of runs. If you stopped there, you'd conclude the IVR loop had nothing
left to do.

When we ran QHE's per-problem `check()` functions over the same outputs as a
post-hoc analysis step, only **27.8%** of those QKT-clean programs actually
behaved correctly. The remaining 72% imported the right modules, called
non-deprecated functions, and still produced the wrong answer, raised an
exception, or built a circuit with the wrong shape.

This is the gap a linter cannot see. `flake8-qiskit-migration` parses the AST
and checks for deprecated symbols. It cannot detect a 5-qubit circuit when
the prompt asked for 3, a missing measurement, or a control flow bug.
Catching those requires running the code.

## Wiring `check()` into the loop

The Mellea side of this turned out to be small. The example's
`generate_validated_qiskit_code()` function already accepted a list of
requirements, but the QKT rule was hardcoded inside it. To inject a
per-problem functional test from the benchmark harness without forking
the example, we added an
[`extra_requirements`](https://github.com/generative-computing/mellea/blob/365f8631/docs/examples/instruct_validate_repair/qiskit_code_validation/qiskit_code_validation.py#L77)
parameter:

```python
def generate_validated_qiskit_code(
    m: MelleaSession,
    prompt: str,
    strategy: MultiTurnStrategy | RepairTemplateStrategy,
    *,
    system_prompt: str | None = None,
    grounding_context: dict[str, str] | None = None,
    extra_requirements: list[Requirement] | None = None,
) -> tuple[str, bool, int]:
    code_candidate = m.instruct(
        prompt,
        requirements=[
            req(
                "Code must pass Qiskit migration validation (QKT rules)",
                validation_fn=simple_validate(validate_qiskit_migration),
            ),
            *(extra_requirements or []),
        ],
        strategy=strategy,
        return_sampling_results=True,
    )
    # ...
```

With that in place, the benchmark builds a `check()` validator from each
prompt's per-problem test and passes it through:

```python
def make_qhe_check_validator(check_fn: str, entry_point: str):
    def validator(code: str) -> tuple[bool, str]:
        try:
            namespace: dict = {}
            exec(code, namespace)
            fn = namespace[entry_point]
            exec(check_fn, namespace)
            namespace["check"](fn)
            return True, ""
        except AssertionError as e:
            return False, f"check() assertion failed: {e}"
        except Exception as e:
            return False, f"check() raised {type(e).__name__}: {e}"
    return validator

extra = [
    req(
        "Code must pass QHE check() function",
        validation_fn=simple_validate(
            make_qhe_check_validator(check_fn, entry_point)
        ),
    ),
]

code, success, attempts = generate_validated_qiskit_code(
    m, prompt, strategy, extra_requirements=extra,
)
```

Mellea handles the rest: a run is `success: true` only if both validators
pass, and any failure (static or dynamic) feeds its message back into the
repair prompt for the next attempt.

## What changed

Same Qiskit-specialized model, same 302 runs (151 prompts × 2 strategies),
same 10-attempt repair budget. The only change is that the IVR loop can now
see test failures while it still has attempts left, instead of after the fact.

| Validator inside the loop | Pass rate |
| --- | --- |
| QKT only | 84/302 = **27.8%** |
| QKT + `check()` | 152/302 = **50.3%** |

The lift held across difficulty tiers, not just the easy ones:

| Difficulty | QKT only | QKT + tests | Lift |
| --- | --- | --- | --- |
| basic | 41.0% | 61.4% | +20.4pp |
| intermediate | 14.7% | 39.6% | +24.9pp |
| difficult | 0% | 20.0% | +20.0pp |

The "difficult" row is the most striking. With QKT alone, no run on a
difficult prompt was functionally correct. With dynamic feedback in the
loop, two of ten passed, including a for-loop circuit construction problem
(`qiskitHumanEval/150`) that one strategy solved on the first attempt and
the other reached after nine repair iterations.

The repair loop also activated more often, exactly as you'd hope. In the
QKT-only run, only 3.6% of passes needed any repair at all; the loop was
mostly idle. With `check()` in the loop, **21% of passes required at least
one repair attempt**, and every failure exhausted the full 10-attempt
budget. The model wasn't giving up; it was working, and sometimes that work
paid off late in the budget.

## Why feedback shape matters more than feedback presence

Wiring a dynamic validator into the loop is necessary but not
sufficient. A `check()` that fails with a bare `AssertionError` and no
message gives the repair prompt nothing to work with. The model sees "your
code failed a test" and is left to guess which one and how.

That's what QHE assertions looked like at the time of this benchmark. A
[QHE PR](https://github.com/qiskit-community/qiskit-human-eval/pull/88)
adds f-string messages to every assertion, and we benchmarked against that PR:

```python
# Before
assert result.num_qubits == 3

# After
assert result.num_qubits == 3, f"Expected 3 qubits, got {result.num_qubits}"
```

Those messages are what the repair loop consumes. When the validator says
"Expected 3 qubits, got 5," the next instruction includes that text, and
the model has a concrete thing to fix. This is the same property that made
QKT useful in the first post: the validator names the violation in words
the model can act on. Pass/fail without context is not enough feedback to
repair against, regardless of whether the validator is static or
dynamic.

## What transfers, and what doesn't

The QHE `check()` functions are not a generic Qiskit validator. Each one is
a hand-written test for a specific benchmark problem: it knows the function
name to call, the inputs to pass, and the properties to assert. They exist
because QHE is an evaluation dataset, not a Qiskit toolkit, and there is no
equivalent "check any Qiskit code for correctness" tool. The numbers above
shouldn't be read as drop-in deployment results.

What does transfer is the pattern. Many real codebases already ship
something `check()`-shaped: a pytest suite, a smoke-test script, an
import-and-run sanity check, a runtime assertion, a domain-specific
validator. Anything that runs the generated code and returns human-readable
failure text can be plugged into Mellea's IVR loop the same way `check()`
was. Adding dynamic signal to a static-only loop produces substantial gains,
as our benchmark above shows. What you plug in is up to
your project.

## Strategy choice flipped under richer feedback

We tested two of Mellea's sampling strategies in our benchmarks:
`RepairTemplateStrategy`, which appends each validation failure to a single
growing instruction, and `MultiTurnStrategy`, which adds each failure as a
new turn in the conversation history. Which one to use depends on what kind of
feedback the loop is working with, and adding `check()` flipped that for us.

In our QKT-only baseline, `MultiTurnStrategy` had a small edge. With
dynamic feedback added, the picture flipped: `MultiTurnStrategy` passed
92% of its successes on the first attempt but rescued only 6 cases through
repair, while `RepairTemplateStrategy` passed 66% on the first attempt and
**rescued 26 cases through sustained repair**, some at 7, 9, and 10
attempts. Both strategies reached similar overall pass rates (51% vs
49.7%), but they got there differently.

When failure feedback is rich enough to keep iterating on, accumulating
that feedback into a single growing prompt (RepairTemplate) seems to help
the model converge on hard cases. When the failure signal is thin,
conversational turn structure (MultiTurn) is steadier. If your validator
returns specific, descriptive errors, RepairTemplate is the better choice on
hard problems.

## Takeaways

Static validation in the IVR loop is a strong floor. For Qiskit migration
specifically, it gets a specialized model to 100% lint compliance with
minimal effort, and that's a genuinely useful property to deploy. But the
ceiling on functional correctness is set by what the validator can see, and
a linter cannot see behavior.

When you can put a dynamic validator into the loop, even a narrow one
that only covers part of your code's intent, the lift in our benchmark was
~22 percentage points across all difficulty tiers, including problems that
were previously unreachable. The integration cost was a list of
`Requirement` objects.

The full benchmark code, results, and analysis are
[on GitHub](https://github.com/ajbozarth/toolbox/tree/main/mellea/qiskit_code_validation/benchmarking#phase-4--check-as-live-ivr-validator-v3-qiskit-model-lsf).
The Qiskit IVR example is in the
[Mellea repo](https://github.com/generative-computing/mellea/tree/main/docs/examples/instruct_validate_repair/qiskit_code_validation).
If your codebase has a test suite, a runtime check, or any validator that
returns human-readable failure text, it's worth ten minutes to see what
plugging it into the repair loop does for you.

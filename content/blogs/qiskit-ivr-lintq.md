---
title: "Tests Pass, Smells Stay: Adding a Quantum Linter to Qiskit IVR"
date: "2026-10-23"
author: "Greta Dolcetti"
excerpt: "Quantum programs can pass every test and still carry quantum-specific code smells. We wired LintQ into Mellea's Instruct-Validate-Repair loop next to the test suite and roughly tripled the share of generations that are both correct and smell-free."
tags: ["qiskit", "IVR", "validation", "static-analysis", "LLM", "quantum", "code-generation"]
---

This series has been adding validators to Mellea's Instruct-Validate-Repair
(IVR) loop for Qiskit, one gap at a time. The
[first post](https://mellea.ai/blogs/qiskit-ivr-code-validation/) used
`flake8-qiskit-migration` to catch deprecated APIs. The
[second](https://mellea.ai/blogs/qiskit-ivr-functional-validation/) put each benchmark
problem's `check()` test in the loop, so the model could see when its code
ran but gave the wrong answer.

This post covers a third gap: code that uses the right APIs, passes its
tests, and still contains code smells that might silently impact the
program execution.

## Code smells that tests don't see

A *code smell* is code that runs without error but is likely to cause
incorrect or unexpected behavior. Python developers have a mature linting
culture for these. However, quantum programs have their own class of smells, which
classical linters and unit tests are not able to catch: a
gate applied after a qubit has already been measured, a register that is
allocated and never used, etc.

[LintQ](https://github.com/sola-st/LintQ) is a static analyzer for Qiskit
built on [CodeQL](https://codeql.github.com/). It models circuits,
registers, and gates as CodeQL abstractions and ships queries for ten
quantum-specific smells described in the [LintQ paper](https://arxiv.org/abs/2310.00718), including:

| LintQ rule | What it flags |
| --- | --- |
| `measure-all-abuse` | `measure_all()` used although a classical register already exists |
| `operation-after-measurement` | Gate applied to a qubit after it was measured |
| `constant-classic-bit` | A qubit is measured but was never transformed |
| `oversized-circuit` | Register with allocated but unused qubits |
| `double-measurement` | Two measurements in a row on the same qubit |

LintQ is neither sound nor complete, like most linters. But it is
deterministic and reproducible, and when it flags something it names the
rule and the circuit involved. As the earlier posts showed, that is the
property that matters for a repair loop.

## Two validators, one requirement

The setup follows the earlier posts: Mellea's `m.instruct()` with a
requirement and a `MultiTurnStrategy`. The difference is that the
requirement's validation function now runs two checks in sequence:

```python
from mellea.stdlib.requirements import req, simple_validate
from validation_helpers import extract_code_from_markdown, validate_correctness

# validate_lintq() is defined in the next snippet


def tests_and_lintq(problem: dict):
    def check(output: str) -> tuple[bool, str]:
        code = extract_code_from_markdown(output)
        passed, reason = validate_correctness(problem, code)
        return validate_lintq(code) if passed else (passed, reason)

    return req(
        "The code must pass the problem's test suite and raise no LintQ warnings",
        validation_fn=simple_validate(check),
    )
```

`simple_validate` hands `check()` the model's latest output as a string, and
turns the `(passed, reason)` tuple it returns into a validation result whose
reason becomes the repair feedback.

Correctness goes first, because there's no point linting a program that
doesn't run. `validate_correctness()` executes the code against the
problem's own test suite with a 30-second timeout. In order to keep functional
correctness as a first order priority, only a program that
passes the tests gets linted.

`validate_lintq()` writes the code to a temporary directory, builds a
CodeQL database from it, runs the `LintQ-all.qls` query suite, and turns the
SARIF results into repair feedback, one `[rule-id] message` line per finding:

```python
import json
import os
import subprocess
import tempfile


def validate_lintq(code: str) -> tuple[bool, str]:
    lintq = os.environ["LINTQ_DIR"]
    with tempfile.TemporaryDirectory() as tmp:
        os.makedirs(f"{tmp}/src")
        with open(f"{tmp}/src/candidate.py", "w") as f:
            f.write(code)
        for cmd in (
            ["database", "create", f"{tmp}/db", "--language=python", f"--source-root={tmp}/src"],
            [
                "database", "analyze", f"{tmp}/db", f"{lintq}/LintQ-all.qls",
                "--format=sarifv2.1.0", f"--output={tmp}/out.sarif",
                f"--additional-packs={lintq}/qlint/codeql/src:{lintq}/qlint/codeql/lib",
            ],
        ):
            subprocess.run(["codeql", *cmd], check=True, capture_output=True)
        with open(f"{tmp}/out.sarif") as f:
            results = [r for run in json.load(f)["runs"] for r in run["results"]]

    if not results:
        return True, ""
    findings = "\n".join(f"[{r['ruleId']}] {r['message']['text']}" for r in results)
    return False, f"LintQ warnings:\n{findings}"
```

Wiring it into Mellea is the same `m.instruct()` call as before. Each problem
gets its own session with a fresh `ChatContext`, so one task's repair
conversation never leaks into the next:

```python
from mellea import start_session
from mellea.stdlib.context import ChatContext
from mellea.stdlib.sampling import MultiTurnStrategy

with start_session(backend_name="<backend>", model_id="<model-id>", ctx=ChatContext()) as m:
    result = m.instruct(
        problem["prompt"],
        requirements=[tests_and_lintq(problem)],
        strategy=MultiTurnStrategy(loop_budget=3),
        return_sampling_results=True,
    )
```

## Results

We ran `gpt-oss-120b` on
the *hard* variant of Qiskit HumanEval, where the prompt is a
natural-language instruction with no code stub, so the model also has to
write the function signature. We also ran it on the full Quantum Katas set.
The loop budget was three attempts: the first generation plus up to two
repairs. "First pass" is generation 0 on its own; "post repair" is the
outcome of the whole loop.

To reproduce these numbers, this is the setup we used:

| Component | Version or setting |
| --- | --- |
| Model | `gpt-oss-120b`, served through an OpenAI-compatible endpoint and called with Mellea's `OpenAIBackend` |
| Strategy | `MultiTurnStrategy(loop_budget=3)` |
| Python | 3.12.8 |
| Mellea | 0.7.0 |
| Qiskit | `qiskit` 2.4.2, `qiskit-aer` 0.17.2, `qiskit-ibm-runtime` 0.45.1, `qiskit-ibm-transpiler` 0.18.0 |
| CodeQL CLI | 2.26.3 |
| IBM Quantum account | Saved using (`QiskitRuntimeService.save_account(...)`) |

> **Note:** LintQ only runs on programs that pass their tests. If the
> "Flagged by LintQ" or "LintQ warnings raised" count goes up after repair,
> it's only because the loop fixed correctness for more programs, so more of
> them reached LintQ. It doesn't mean repair made the code smellier.

### Qiskit HumanEval (hard), 151 tasks

| Metric | First pass | Post repair |
| --- | --- | --- |
| Passed both validators | 24/151 (16%) | **70/151 (46%)** |
| Failed | 127/151 (84%) | 81/151 (54%) |
| Failed the test suite | 113 | 77 |
| Flagged by LintQ | 14 | 4 |
| LintQ warnings raised | 17 | 4 |
| Fixed by the repair loop | — | 46 |

### Qiskit Quantum Katas, 350 tasks

| Metric | First pass | Post repair |
| --- | --- | --- |
| Passed both validators | 25/350 (7%) | **163/350 (47%)** |
| Failed | 325/350 (93%) | 187/350 (53%) |
| Failed the test suite | 297 | 148 |
| Flagged by LintQ | 28 | 39 |
| LintQ warnings raised | 30 | 47 |
| Fixed by the repair loop | — | 138 |

With a budget of three attempts, the share of tasks that are both correct and
smell-free went from 16% to 46% on Qiskit HumanEval (hard) and from 7% to
47% on Quantum Katas.

## Takeaways

The three posts in this series use three kinds of validator, and each one
catches problems the others miss:

| Validator | Catches | Misses |
| --- | --- | --- |
| `flake8-qiskit-migration` | Deprecated and removed APIs | Behavior |
| Functional tests (`check()`) | Wrong answers, crashes | Quantum-specific smells |
| LintQ | Quantum code smells | Behavior, and intent |

None of them required changes to Mellea. Each is a function that returns
`(is_valid, error_message)`, wrapped in a requirement. The loop takes care of
turning failures into repair prompts. The more validators you stack, the
more aspects are checked and enforced during the generation.

A few practical notes if you want to try LintQ in your own loop:

- **Check correctness first.** LintQ builds a CodeQL database for every
  candidate, which takes a few seconds. Skipping that for programs that fail
  their tests saves time and keeps the repair feedback focused on one
  problem at a time.
- **Keep the rule ID in the message.** `[ql-unmeasurable-qubits] Circuit
  'qc' has more qubits (1) than classical bits (0)` tells the model which
  rule fired and on which circuit.

## Try it

LintQ is a set of CodeQL queries, so it needs the CodeQL CLI and a checkout
of the LintQ repository:

1. Install the
   [CodeQL CLI](https://docs.github.com/en/code-security/codeql-cli/getting-started-with-the-codeql-cli/setting-up-the-codeql-cli)
   and put `codeql` on your `PATH` (`brew install codeql` works on macOS).
   Check it with `codeql version`.
2. Clone LintQ and install its query pack dependencies:

   ```bash
   git clone --depth 1 https://github.com/sola-st/LintQ.git
   (cd LintQ/qlint/codeql/src && codeql pack install)
   ```

3. Point `LINTQ_DIR` at the checkout:

   ```bash
   export LINTQ_DIR="$(pwd)/LintQ"
   ```

This blog post is built as an extension of the [Mellea IVR example](https://github.com/generative-computing/mellea/tree/main/docs/examples/instruct_validate_repair/qiskit_code_validation).
The full reproduction code, including the LintQ validator, will be released in the IBM open-source project [CodeHelm](https://github.com/IBM/codehelm).
Adding LintQ to it means adding one more validation function with the code shown above.

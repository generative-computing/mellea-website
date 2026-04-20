---
title: "Automatically Fixing Deprecated Qiskit Code with Instruct-Validate-Repair"
date: "2026-04-20"
author: "Alex Bozarth"
excerpt: "How we used Mellea's Instruct-Validate-Repair pattern with flake8-qiskit-migration to automatically catch and fix deprecated Qiskit APIs in LLM-generated code."
tags: ["qiskit", "IVR", "reliability", "LLM", "quantum", "code-generation"]
---

If you've used an LLM to help write Qiskit code, you've probably been burned. The model
confidently generates something that looks right, until you run it and get a `DeprecationWarning`,
an `AttributeError`, or a silent failure because `BasicAer` was removed two major versions ago.
Qiskit has moved fast: primitives replaced `execute()`, `AerSimulator` moved packages, and a
half-dozen APIs were retired across the Qiskit 1.x and 2.x cycles. LLMs trained before those changes don't know
what they don't know.

The usual fix is manual review: you paste the output, cross-reference the migration guide, fix the
imports, and try again. That works once. It doesn't scale, and it requires the reviewer to already
know which APIs are deprecated, defeating the purpose of asking an LLM in the first place.

[Mellea](https://mellea.ai) is a Python library for building reliable LLM applications that adds
verifiable requirements and automatic repair to LLM calls. We built [an example](https://github.com/generative-computing/mellea/tree/951145d6fc6e2977c388e164fb78904fcc2fb71a/docs/examples/instruct_validate_repair/qiskit_code_validation)
that applies its **Instruct-Validate-Repair (IVR)** pattern to Qiskit, using
[`flake8-qiskit-migration`](https://github.com/qiskit-community/flake8-qiskit-migration) as the
validator: generate code, check it against the migration rules, repair any violations, repeat.
`flake8-qiskit-migration` doesn't just report failures; it returns the specific rules violated and
their replacements, so the model knows exactly what to fix on each retry.

## The Problem: LLMs Don't Know What Changed

Qiskit's migrations from 0.x to 1.x and 1.x to 2.x deprecated dozens of APIs. A few common offenders:

| Deprecated | Modern replacement |
| --- | --- |
| `BasicAer.get_backend(...)` | `from qiskit_aer import AerSimulator` |
| `execute(circuit, backend)` | `SamplerV2(backend).run([circuit])` |
| `transpile(circuit, backend)` | `generate_preset_pass_manager(...).run(circuit)` |
| `QuantumCircuit.cnot()` | `QuantumCircuit.cx()` |
| `qiskit-ibmq-provider` / `IBMQ` | `qiskit-ibm-runtime` |

When you ask a general-purpose LLM to write Qiskit code, it often reaches for these deprecated
patterns, especially for anything involving backends or execution. It's not hallucinating; it's
recalling real code that worked at some point. The problem is that it can't distinguish between
"valid then" and "valid now."

Here's a typical prompt and the kind of output you'd get before this fix:

```python
# Prompt given to the LLM:
# "Write a 5-qubit GHZ circuit and run it on a simulator"

# What a non-specialized LLM often returns:
from qiskit import BasicAer, QuantumCircuit, execute

backend = BasicAer.get_backend('qasm_simulator')

qc = QuantumCircuit(5, 5)
qc.h(0)
qc.cnot(0, range(1, 5))
qc.measure_all()

job = execute(qc, backend)
result = job.result()
```

This code uses `BasicAer` (removed), `execute()` (removed), and `cnot()` (removed). Running it
on Qiskit 1.x or later fails immediately. Without automated validation, the only way to catch
this is human review, or waiting for the runtime error.

## The Solution: Instruct-Validate-Repair

Mellea's IVR pattern structures LLM interactions as a loop:

1. **Instruct**: Ask the LLM to generate code against a set of requirements
2. **Validate**: Check the output against those requirements using a real validator
3. **Repair**: If validation fails, feed the specific failure reasons back to the LLM and retry

For Qiskit, the validator is the `flake8-qiskit-migration` plugin, the same tool used to enforce
migration rules in production codebases. It parses the generated code's AST and checks it against
the full catalog of custom-defined Qiskit (QKT) rules. When it finds a violation, it returns a structured error like:

```console
QKT101: QuantumCircuit.cnot() has been removed in Qiskit 1.0; use `.cx()` instead
```

That error message is exactly what the LLM needs to fix the problem. IVR routes it back as repair
context, and the model tries again, up to 10 times by default.

A repair loop is only as useful as the feedback it works from. A validator that returns a bare
pass/fail gives the LLM nothing to act on, so retries are just guessing. The
`flake8-qiskit-migration` plugin returns rule codes that name the deprecated symbol and its
replacement, so each attempt is guided by the exact constraint that failed.

### The Pipeline in Code

`generate_validated_qiskit_code()` wires the IVR loop together in about 20 lines:

```python
def generate_validated_qiskit_code(
    m: MelleaSession,
    prompt: str,
    strategy: RepairTemplateStrategy,
) -> tuple[str, bool, int]:
    code_candidate = m.instruct(
        prompt,
        requirements=[req(
            "Code must pass Qiskit migration validation (QKT rules)",
            validation_fn=simple_validate(validate_qiskit_migration),
        )],
        strategy=strategy,
        return_sampling_results=True,
    )

    attempts = len(code_candidate.sample_generations) if code_candidate.sample_generations else 1
    if code_candidate.success:
        return str(code_candidate.result), True, attempts
    # ... return best attempt on failure
```

You pass `m.instruct()` a prompt, a list of requirements with validation functions, and a strategy.
Mellea handles the loop: generate, validate, repair, repeat.

The validation function delegates to `flake8-qiskit-migration`:

```python
def validate_qiskit_migration(md_code: str) -> tuple[bool, str]:
    code = extract_code_from_markdown(md_code)  # strips ```python fences
    tree = ast.parse(code)
    plugin = Plugin(tree)
    errors = list(plugin.run())

    if not errors:
        return True, ""
    error_messages = [message for _, _, message, _ in errors]
    return False, "\n".join(error_messages)
```

The error string returned on failure becomes the repair context: the LLM sees exactly which QKT
rules it violated and what the correct replacement is.

### Two Repair Strategies

The example supports two strategies for how the repair context is delivered. **RepairTemplateStrategy**
(default) incorporates the validation errors into a revised instruction and retries; it works with
`SimpleContext`, keeping each attempt independent. **MultiTurnStrategy** adds validation failures
as a new user message in a running conversation, building up history across attempts, and requires
`ChatContext`.

To switch strategies:

```python
use_multiturn_strategy = True  # False = RepairTemplateStrategy (default)
ctx = ChatContext() if use_multiturn_strategy else SimpleContext()
strategy = MultiTurnStrategy(loop_budget=10) if use_multiturn_strategy else RepairTemplateStrategy(loop_budget=10)
```

### Running It

The example uses `uv run` for zero-setup dependency management: `mellea` and
`flake8-qiskit-migration` are installed automatically:

```bash
uv run docs/examples/instruct_validate_repair/qiskit_code_validation/qiskit_code_validation.py
```

You'll also need [Ollama](https://ollama.ai) running locally with the recommended model:

```bash
ollama pull hf.co/Qiskit/mistral-small-3.2-24b-qiskit-GGUF:latest
ollama serve
```

## Seeing It Work

Running the example against the default deprecated prompt:

````console
====== Prompt ======
from qiskit import BasicAer, QuantumCircuit, execute

backend = BasicAer.get_backend('qasm_simulator')

qc = QuantumCircuit(5, 5)
qc.h(0)
qc.cnot(0, range(1, 5))
qc.measure_all()

# run circuit on the simulator
======================

Validation failed with 1 error(s):
QKT101: QuantumCircuit.cnot() has been removed in Qiskit 1.0; use `.cx()` instead

====== Result (23.1s, 2 attempt(s)) ======
```python
from qiskit_aer import AerSimulator, QuantumCircuit

backend = AerSimulator()

qc = QuantumCircuit(5, 5)
qc.h(0)
qc.cx(0, range(1, 5))
qc.measure_all()
```
======================

✓ Code passes Qiskit migration validation
````

Two attempts, 23 seconds. The deprecated `BasicAer`, `execute`, and `cnot` are gone, replaced with their modern equivalents.

The recommended model is a [Qiskit-specialized fine-tune of Mistral Small](https://huggingface.co/Qiskit/mistral-small-3.2-24b-qiskit-GGUF)
(`hf.co/Qiskit/mistral-small-3.2-24b-qiskit-GGUF:latest`, ~15GB). It has current Qiskit API
knowledge baked in and works without a system prompt. Learn more about the available models for Qiskit-related tasks in the
[official documentation](https://quantum.cloud.ibm.com/docs/en/guides/qiskit-code-assistant-local) or in the
[Qiskit HuggingFace organization](https://huggingface.co/Qiskit). Lighter general-purpose models can be
substituted but produce less consistent results; if you go that route, set
`system_prompt = QISKIT_SYSTEM_PROMPT` in the example. Stay tuned for a deeper look at model and strategy
performance across both datasets in a follow-up post.

## Try It

The full example is in the Mellea repo:
[`docs/examples/instruct_validate_repair/qiskit_code_validation/`](https://github.com/generative-computing/mellea/tree/main/docs/examples/instruct_validate_repair/qiskit_code_validation)

If you're catching deprecated Qiskit API errors in code review, or worse at runtime, this
is a drop-in addition to any LLM-assisted Qiskit workflow.

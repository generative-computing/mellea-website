---
title: "See Inside Your LLM Pipeline: Mellea's New Debug Plugins"
date: 2026-06-14
author: "Mellea Contributors"
excerpt: "Trace generation, validation, and sampling in detail. Built-in plugins reveal model calls, requirement failures, repair events, and loop iterations—all without boilerplate."
tags: ["debugging", "plugins", "observability"]
---

## The Black Box Problem

You've built an LLM pipeline in Mellea. Requirements are passing locally, sampling seems fine, but when you run it on real data, something unexpected fails. Which requirement? On which iteration? Did the repair strategy even trigger? Did the model get the feedback?

Right now, you're flying blind. You add print statements. You write custom callbacks. You piece together logs from stderr, stdout, and your logger. Every pipeline needs its own debugging setup, and you end up rewriting the same introspection code across projects.

Mellea 0.7.0 includes **built-in debug plugins**—eight production-ready hooks across three categories that trace your entire LLM pipeline without writing a single line of instrumentation code. See model calls, token counts, requirement validation, repair events, and sampling iterations with structured logging designed for troubleshooting.

---

## What You Can See Now

Before debug plugins, understanding a failed sampling run meant reconstructing it from logs or adding custom instrumentation. Now you get complete visibility into three layers of your pipeline:

**Generation pipeline**: What prompt did the model see? How long did it take? How many tokens? Was repair feedback provided?

```text
[📤 GEN-PRE-CALL gen_id=abc123...] model=granite4.1:3b | prompt=Write a thank you note
[📥 GEN-POST-CALL gen_id=abc123...] model=granite4.1:3b | latency=397ms | tokens=(47+19=66) | response=hello there thank you...
```

**Validation pipeline**: Which requirements passed, which failed, and why? What was the LLM's reasoning for a failure?

```text
[🔍 VALIDATION-PRE-CHECK] requirements=3 | target=ModelOutputThunk

[❌ VALIDATION-POST-CHECK] MIXED RESULTS: 2/3 passed, 1/3 failed
    ✓ Use only lowercase letters
    ✓ Include the phrase 'thank you'
    ❌ Start with a greeting
       └─ validated as "no"
```

**Sampling pipeline**: How many iterations? When did repairs trigger? What feedback did the model receive?

```text
[🎯 SAMPLING-START] strategy=RepairTemplateStrategy | loop_budget=3 | requirements=3

[❌ SAMPLING-ITER 1] FAILED: 2/3 validations passed
    ❌ Start with a greeting

[🔧 REPAIR-TRIGGERED] at iteration 1
   repair_type=template
   failed_validations:
     • Start with a greeting

[❌ SAMPLING-ITER 2] FAILED: 2/3 validations passed
    ❌ Start with a greeting

[🎉 SAMPLING-END] SUCCESS in 2 iteration(s) using RepairTemplateStrategy
   total_attempts=2
   best_validation_score=3/3

[💥 SAMPLING-END] FAILED after 3 iteration(s): budget exhausted
   total_attempts=3
   best_validation_score=2/3
```

Combine all three and you see the complete flow: which requirements checked, whether repairs helped, and how the model responded to feedback.

---

## Using Debug Plugins

The plugin API is straightforward. Import the hooks you need, register them, and they fire automatically:

```python
from mellea.plugins.builtin_debug.generation import (
    log_generation_pre_call,
    log_generation_post_call,
)
from mellea.plugins.builtin_debug.validation import (
    log_validation_pre_check,
    log_validation_post_check,
)
from mellea.plugins.builtin_debug.sampling import (
    log_sampling_loop_start,
    log_sampling_iteration,
    log_sampling_repair,
    log_sampling_loop_end,
)
from mellea.plugins import register

register([
    log_generation_pre_call,
    log_generation_post_call,
    log_validation_pre_check,
    log_validation_post_check,
    log_sampling_loop_start,
    log_sampling_iteration,
    log_sampling_repair,
    log_sampling_loop_end,
])
```

Every generation, validation check, and sampling iteration now logs structured output. No callbacks, no context managers, no custom wiring. The plugins hook into Mellea's lifecycle automatically.

For scoped debugging (plugins active only for one task), use `plugin_scope`:

```python
from mellea.plugins import plugin_scope

with plugin_scope([log_generation_pre_call, log_generation_post_call]):
    with mellea.start_session() as m:
        result = m.instruct(
            "Write a thank you note",
            requirements=[...],
            strategy=RepairTemplateStrategy(loop_budget=3),
        )
        # Plugins fire here, logged to stderr
```

Control verbosity with standard Python logging:

```python
import logging

# Show only failures and key events
logging.basicConfig(level=logging.INFO)

# Show all details including passed requirements
logging.basicConfig(level=logging.DEBUG)

# Silence noisy loggers
logging.getLogger("httpx").setLevel(logging.ERROR)
```

---

## Runnable Examples

Mellea includes seven runnable examples showing each plugin category and common workflows in `docs/examples/plugins/`:

| Script                               | Plugins                 | Purpose                                   |
| ------------------------------------ | ----------------------- | ----------------------------------------- |
| `builtin_generation_tracing.py`      | Generation              | Basic model call tracing                  |
| `builtin_validation_tracing.py`      | Validation              | Requirement validation passes and fails   |
| `builtin_validation_failures.py`     | Validation              | See real validation failures              |
| `builtin_validation_strict.py`       | Validation              | Strict requirements testing               |
| `builtin_sampling_diagnostics.py`    | Sampling                | Strategy iterations and repair events     |
| `builtin_full_pipeline_tracing.py`   | Generation + Sampling   | End-to-end with model visibility          |
| `builtin_complete_diagnostics.py`    | All 3                   | Complete pipeline with validation         |

Run any example:

```bash
uv run python docs/examples/plugins/builtin_generation_tracing.py
uv run python docs/examples/plugins/builtin_complete_diagnostics.py
```

Here's `builtin_complete_diagnostics.py` in action, showing all three plugin categories together:

```python
import logging
import mellea
from mellea.core import Requirement
from mellea.plugins import plugin_scope
from mellea.plugins.builtin_debug.generation import (
    log_generation_post_call,
    log_generation_pre_call,
)
from mellea.plugins.builtin_debug.sampling import (
    log_sampling_iteration,
    log_sampling_loop_end,
    log_sampling_loop_start,
    log_sampling_repair,
)
from mellea.plugins.builtin_debug.validation import (
    log_validation_post_check,
    log_validation_pre_check,
)
from mellea.stdlib.requirements import req, simple_validate
from mellea.stdlib.sampling import RepairTemplateStrategy

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

def is_lowercase_only(text: str) -> bool:
    return text == text.lower()

def has_thank_you(text: str) -> bool:
    return "thank you" in text.lower()

requirements = [
    req("Start with a greeting"),
    req(
        "Use only lowercase letters (no capitals)",
        validation_fn=simple_validate(is_lowercase_only),
    ),
    req("Include the phrase 'thank you'", validation_fn=simple_validate(has_thank_you)),
]

with plugin_scope([
    log_generation_pre_call,
    log_generation_post_call,
    log_validation_pre_check,
    log_validation_post_check,
    log_sampling_loop_start,
    log_sampling_iteration,
    log_sampling_repair,
    log_sampling_loop_end,
]):
    with mellea.start_session() as m:
        result = m.instruct(
            "Write a thank you note",
            requirements=requirements,
            strategy=RepairTemplateStrategy(loop_budget=3),
        )
        print(f"\nFinal result:\n{result}")
```

Now you see the complete flow: what prompts the model saw, which validations failed, when repairs triggered, and the final result.

---

## Solving Common Debugging Scenarios

### "Why is the model generating a different response than I expected?"

Enable generation tracing to see the exact prompt sent to the model, latency, token counts, and the response. If you're using a repair strategy, you'll also see what feedback the model received on the second attempt:

```python
register([
    log_generation_pre_call,
    log_generation_post_call,
])
```

This tells you whether the issue is in the prompt, model behavior, or repair feedback.

### "Why are my requirements failing?"

Enable validation tracing to see each requirement being checked, pass/fail status, and the model's reasoning for failures:

```python
register([
    log_validation_pre_check,
    log_validation_post_check,
])
```

This pinpoints which requirements are problematic and where the issue lives: requirement definition, validation function, or model behavior.

### "Why isn't the repair strategy helping?"

Enable all three plugin categories to see the full picture: initial attempt and its failures, the repair feedback the model received, the second attempt with feedback, and whether repair actually improved results.

### "Why is sampling taking so long?"

Enable sampling tracing to see how many iterations ran, validation results per iteration, when repairs triggered, and total attempts. This tells you whether the bottleneck is budget exhaustion, frequent failures, or ineffective repairs:

```python
register([
    log_sampling_loop_start,
    log_sampling_iteration,
    log_sampling_repair,
    log_sampling_loop_end,
])
```

---

## Design Choices and Trade-offs

The plugins are designed with minimal overhead: registration checks happen once at startup, logging is efficient, and no overhead occurs unless plugins are explicitly enabled.

Logs use structured key-value pairs (model, latency, tokens) instead of freeform strings. This makes them easier to parse programmatically—for example, `grep "FAILED:" debug.log`—and keeps the door open for future exports to Jaeger, Grafana, or other observability platforms.

The plugin system uses Mellea's built-in lifecycle hooks rather than agent infrastructure. This means plugins don't add dependencies and work in any context where Mellea runs.

Plugins are opt-in: they don't fire unless explicitly registered. This keeps baselines fast and lets you choose which lifecycle events matter. For production, you can safely leave them registered since they only log when enabled.

These plugins trace core generation, validation, and sampling. Intrinsic adapters (RAG, safety checks, calibration) will get their own plugins in the roadmap.

---

## What's Next

Debug plugins ship today in Mellea 0.27. The plugin system is built for extension. You can build team-specific instrumentation using the same hook infrastructure, export traces to Jaeger or Grafana, add plugins for Granite intrinsics (RAG, safety, calibration), and export logs as JSON for analysis.

The plugins are available now. Run the examples, enable the categories you need, and start seeing inside your pipeline.

---

## Get Started

Start with the [full how-to guide](https://github.com/generative-computing/mellea/blob/main/docs/docs/how-to/debug-with-plugins.md), then run any example:

```bash
uv run python docs/examples/plugins/builtin_complete_diagnostics.py
```

The plugin modules are at:

- Generation: `mellea.plugins.builtin_debug.generation`
- Validation: `mellea.plugins.builtin_debug.validation`
- Sampling: `mellea.plugins.builtin_debug.sampling`

Debug plugins give you observability without instrumentation overhead. If you hit gaps or have ideas for new hooks, [open an issue](https://github.com/generative-computing/mellea/issues).

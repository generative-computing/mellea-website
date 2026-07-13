---
title: "Tools your agents can actually run: Mellea v0.7.0"
date: "2026-07-13"
author: "Mellea Contributors"
excerpt: "Mellea v0.7.0 ships a sandboxed code interpreter, a shell tool, and a library of executable requirements — plus context compaction and plugin-based telemetry — so agents can do real work and stay grounded."
tags: ["release", "v0.7"]
---

For most of Mellea's life, an agent could *describe* a computation but not
run one. You could ask a model to write Python that fits a curve or draw a
plot, get back a code block, and then you were on your own. Executing that
code safely, checking it did what you asked, keeping the transcript from
overflowing the context window: all of that was left to you.

Mellea v0.7.0, released July 13, 2026, changes that. This release gives agents
tools they can actually run: a sandboxed Python interpreter and a shell tool
with a safety denylist. It gives you a library of *executable requirements*
that check the output before you trust it. And it lands the plumbing that keeps
long agent runs healthy: context compaction for the ReACT loop, model-aware
sliding-window contexts, and a plugin-based telemetry stack you can extend.
Roughly 120 PRs went into it.

## ⚠️ Breaking Changes

One breaking change lands in the telemetry surface ([#1181](https://github.com/generative-computing/mellea/pull/1181)). Tracing was still pre-1.0, so it ships without a deprecation shim.

- **What changed**:
  - `MELLEA_TRACE_*` environment variables are renamed to the plural
    `MELLEA_TRACES_*`, aligning with `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` and
    the existing `MELLEA_METRICS_*` vars. A new `MELLEA_TRACES_ENABLED`
    umbrella flag and opt-in `MELLEA_TRACES_OTLP` are added.
  - The deprecated `gen_ai.system` span attribute is removed; read
    `gen_ai.provider.name` instead.
  - `is_application_tracing_enabled()` and `is_backend_tracing_enabled()`
    collapse into a single `is_tracing_enabled()`.
  - `add_span_event`, `start_backend_span`, `end_backend_span`, and
    `trace_backend` are removed from `mellea.telemetry`. Backend spans are
    now emitted automatically by `BackendTracingPlugin`; application spans
    still use `trace_application` (unchanged).
  - The `mellea.telemetry.backend_instrumentation` module is deleted.

- **Who is affected**: anyone who set `MELLEA_TRACE_*` env vars, read the
  `gen_ai.system` attribute in a trace consumer, or called the removed
  helper functions directly.

- **Migration**: rename `MELLEA_TRACE_*` → `MELLEA_TRACES_*` in your
  environment, switch trace consumers from `gen_ai.system` to
  `gen_ai.provider.name`, and drop any direct calls to the removed span
  helpers. Backend spans now emit on their own.

## Run code, don't just generate it

Before v0.7.0, "let the agent run a shell command" meant wiring up your own
executor and hoping the model didn't emit something destructive. The new
shell tool ([#1107](https://github.com/generative-computing/mellea/pull/1107))
gives you a `bash_executor` with a conservative safety denylist built in: no
`sudo`, no `rm -rf`, no destructive git operations, no writes to `/etc`,
`/sys`, or `/proc`. You can also constrain writes with `working_dir` and
`allowed_paths`.

```python
from mellea.stdlib.tools.shell import bash_executor

result = bash_executor("ls -la")
print(result.success, result.stdout)
```

You can hand it to a model as a `MelleaTool` for agentic tool-calling, or call
it directly. Commands use argv-friendly syntax: compose multiple commands in
Python rather than relying on pipes or redirects, which keeps the attack
surface small. For untrusted code, the docs are explicit: add container- or
VM-level isolation at the application layer.

Alongside it, the Python code interpreter got a rewrite
([#1190](https://github.com/generative-computing/mellea/pull/1190)) built on
the new sandbox runtime and capability-policy system
([#1171](https://github.com/generative-computing/mellea/pull/1171)), which
lets you declare what generated code is allowed to do rather than trusting it
by default. Follow-on hardening tightened the default execution tier
([#1271](https://github.com/generative-computing/mellea/pull/1271)) and added
a `chmod`/`umask` guard to the interpreter
([#1372](https://github.com/generative-computing/mellea/pull/1372)).

The requirements work below depends on this. Once an agent can *run* code, you
can *validate* what it produced.

## Requirements that execute the output

Mellea's requirements let you assert properties of a model's response. In
v0.7.0 that vocabulary grows past "does this text match a rule" into
requirements that actually exercise generated code.

**Python requirements** ([#1128](https://github.com/generative-computing/mellea/pull/1128))
validate that generated Python parses, imports cleanly, and behaves, turning
"the model wrote some code" into "the code runs." **Matplotlib requirements**
([#1208](https://github.com/generative-computing/mellea/pull/1208)) go
domain-specific: check that plotting code uses a headless backend, that it
actually saves a file, and that its dependencies are available.

```python
from mellea.core import ModelOutputThunk
from mellea.stdlib.context import ChatContext
from mellea.stdlib.requirements.plotting import MatplotlibHeadlessBackend

code = """```python
import matplotlib
matplotlib.use('Agg')  # headless backend, safe on a server
import matplotlib.pyplot as plt
plt.plot([1, 2, 3], [1, 4, 9])
```"""

context = ChatContext().add(ModelOutputThunk(value=code))
result = MatplotlibHeadlessBackend().validation_fn(context)
print(result.as_bool(), result.reason)
```

A model that emits `matplotlib.use('TkAgg')` and `plt.show()` (code that would
hang waiting for a display on a headless server) fails the check instead of
failing in production.

To make these easy to reach for, v0.7.0 adds **sampling presets for Python
code generation** ([#1265](https://github.com/generative-computing/mellea/pull/1265)),
bundling the right requirements and feedback loop so "generate code that
plots this data and actually saves the figure" is a preset, not a project.

## Groundedness: catch the answer that isn't in the documents

RAG systems fail quietly when the model asserts something the retrieved
documents don't support. The new `GroundednessRequirement`
([#773](https://github.com/generative-computing/mellea/pull/773)) validates
that an assistant response is fully backed by citations to the documents it
was given, using a four-step pipeline: generate citations, decide which spans
*need* a citation, assess how well each span is supported, and declare the
response grounded only if every span that needs support gets it.

```python
from mellea.backends.huggingface import LocalHFBackend
from mellea.stdlib.components import Document, Message
from mellea.stdlib.context import ChatContext
from mellea.stdlib.requirements.rag import GroundednessRequirement

backend = LocalHFBackend(model_id="ibm-granite/granite-4.0-micro")
# ...build a ChatContext with your Documents and the assistant response...
requirement = GroundednessRequirement()
```

See the [full example](https://github.com/generative-computing/mellea/blob/v0.7.0/docs/examples/groundedness_requirement_example.py)
for the end-to-end wiring against Granite.

## Keep long agent runs from overflowing context

A ReACT loop that runs for many turns accumulates tool observations until it
blows past the context window. v0.7.0 adds **context compaction strategies**
([#996](https://github.com/generative-computing/mellea/pull/996)) with two
complementary integration points: a per-`add` compactor on `ChatContext` for
cheap strategies like `WindowCompactor`, and a per-turn `compactor=` argument
to `react(...)` for heavier strategies that should fire only at turn
boundaries. `pin_react_initiator` keeps the goal and tool registration alive
across compaction, so the agent doesn't forget what it was doing.

```python
from mellea.stdlib.context.compactor import WindowCompactor

# cheap, fires on every append
context = ChatContext(compactor=WindowCompactor(...))

# or heavier, once per ReACT iteration:
# react(..., compactor=my_compactor)
```

**Model-aware sliding-window context**
([#1270](https://github.com/generative-computing/mellea/pull/1270)) sizes the
window to the target model's actual context length instead of a hard-coded
guess, so the same code does the right thing whether you point it at a small
local model or a long-context hosted one.

## Multimodal `m serve`

`m serve` now handles images end-to-end ([#1184](https://github.com/generative-computing/mellea/pull/1184)):
you can send images to a served model over an OpenAI-compatible endpoint, with
examples for streaming, response formats, and a PII-redaction server. Related
work lets you pass **images as URLs** on supported backends
([#1260](https://github.com/generative-computing/mellea/pull/1260)) instead of
inlining base64, and **re-exports the serve types** from the public `mellea.*`
namespace ([#1243](https://github.com/generative-computing/mellea/pull/1243))
so you can build typed clients without reaching into internal modules.

## Telemetry you can extend, and debugging you can turn on

The telemetry rework ([#1181](https://github.com/generative-computing/mellea/pull/1181),
see Breaking Changes) moves backend tracing off inline calls scattered across
five backends and onto a `BackendTracingPlugin` that subscribes to generation
hooks. Spans now stay live on the OpenTelemetry context across the API call,
so nested instrumentation (httpx, LangChain) parents correctly under the
backend span instead of floating at the root. Follow-on PRs wired **metrics
plugins** to the new batch hooks ([#1254](https://github.com/generative-computing/mellea/pull/1254))
and migrated application spans and stream-chunking telemetry onto the same
plugin/hook pattern ([#1289](https://github.com/generative-computing/mellea/pull/1289),
[#1361](https://github.com/generative-computing/mellea/pull/1361)).

For debugging, v0.7.0 adds **built-in debug plugin collections**
([#1251](https://github.com/generative-computing/mellea/pull/1251)): drop-in
diagnostics for generation tracing, sampling, and validation failures, with a
[how-to guide](https://github.com/generative-computing/mellea/blob/v0.7.0/docs/docs/how-to/debug-with-plugins.md)
and examples for each. When a sampling loop or a validation isn't behaving,
you turn on a plugin instead of adding print statements.

## Other Improvements

### Backends & generation

- **Stopping sequences** are now a first-class model option across all backends.
  ([#1112](https://github.com/generative-computing/mellea/pull/1112))
- **Concurrency in the base sampling strategy** speeds up sampling that issues
  independent generations. ([#1175](https://github.com/generative-computing/mellea/pull/1175))
- **Consolidated to llguidance** from xgrammar for constrained decoding.
  ([#1077](https://github.com/generative-computing/mellea/pull/1077))
- **Standardized logits** on the `ModelOutputThunk`, uniform across backends.
  ([#1261](https://github.com/generative-computing/mellea/pull/1261))
- **Public `error` and `generate_log`** surface on `ModelOutputThunk` for
  inspecting what happened. ([#1307](https://github.com/generative-computing/mellea/pull/1307))
- **`do_sample=True` when a seed is set** on HF backends, so seeding behaves as
  expected. ([#1149](https://github.com/generative-computing/mellea/pull/1149))

### Intrinsics / adapters (Epic #929)

- New **Adapter/Identity/IOContract/WeightsBinding** scaffolding and a rewritten
  `call_intrinsic`, migrating RAG and Guardian intrinsics onto the new types.
  ([#1158](https://github.com/generative-computing/mellea/pull/1158),
  [#1269](https://github.com/generative-computing/mellea/pull/1269),
  [#1321](https://github.com/generative-computing/mellea/pull/1321),
  [#1323](https://github.com/generative-computing/mellea/pull/1323))
- Catalog entries **pinned to Hugging Face revision SHAs** for reproducibility.
  ([#1157](https://github.com/generative-computing/mellea/pull/1157))

### CLI & serve

- **Health-check endpoint** for `m serve`. ([#1100](https://github.com/generative-computing/mellea/pull/1100))
- **`m alora` guards the HF dependency** with a friendly error. ([#1102](https://github.com/generative-computing/mellea/pull/1102))

### Docs

- **Migrated from Mintlify to Docusaurus 3.** ([#1174](https://github.com/generative-computing/mellea/pull/1174))
- Guardian docs moved from the deprecated `GuardianCheck` to the Intrinsics API.
  ([#935](https://github.com/generative-computing/mellea/pull/935))

## Upgrading

```bash
pip install --upgrade mellea
```

If you use tracing, rename your `MELLEA_TRACE_*` environment variables to
`MELLEA_TRACES_*` and switch trace consumers from `gen_ai.system` to
`gen_ai.provider.name`. See [Breaking Changes](#️-breaking-changes) above.

See the [full release notes](https://github.com/generative-computing/mellea/releases/tag/v0.7.0)
for the complete changelog.

<!--
Drafted from: generative-computing/mellea v0.7.0 (https://github.com/generative-computing/mellea/releases/tag/v0.7.0)
Rubric: prefix (Conventional Commits)
Highlight PRs: #1107, #996, #1181, #773, #1208, #1190, #1171, #1184, #1260, #1175, #1251, #1265, #1270, #1128, #1243 (score >= 50)
Mention PRs: #1112, #1077, #1261, #1307, #1149, #1158, #1269, #1321, #1323, #1157, #1100, #1102, #1174, #935, #1254, #1289, #1361, #1271, #1372, #1265 (score 10-49)
Skipped PRs: chore/ci/test/most fix: PRs and dep bumps (score < 10) — e.g. #1129, #1133, #1131, #1113, #418, #578, and the bulk of the Bug Fixes / Other Changes sections
-->

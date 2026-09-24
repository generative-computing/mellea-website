---
title: "Audio in, files out, and a much faster CLI: Mellea v0.8.0"
date: "2026-09-24"
author: "Mellea Contributors"
excerpt: "Mellea v0.8.0 adds audio as an input modality, lets you retrieve the files your sandboxed code produced, cuts m CLI startup from 3.2s to 0.1s, and rebuilds streaming as a plain async iterator. There are breaking changes to review if you use streaming or telemetry."
tags: ["release", "v0.8"]
---

Mellea v0.8.0 was released on 23 September 2026. Most of it makes things you
already do easier:

- **Audio input.** Hand a model a recording the same way you already hand it an
  image.
- **Files out of the sandbox.** What your generated code produced comes back on
  the result, instead of staying in the container.
- **Streaming you drive yourself.** A plain async iterator, with no background
  task to remember.
- **Your own adapters.** A LoRA or aLoRA you trained registers directly.
- **Granite 4.2 by default.** A fresh install pulls a current local model.
- **A much faster `m`.** Startup down from 3.2s to 0.1s.

There are some breaking changes too. If you use streaming, telemetry
dashboards, tool calls, requirements alongside a sampling strategy, or you call
the adapter verbs directly, give [breaking changes](#breaking-changes) a few
minutes before you upgrade. For everything else this should be a straight
version bump.

## Audio in, text out

Audio now works the way images already did
([#1396](https://github.com/generative-computing/mellea/pull/1396)):

```python
from mellea import start_session
from mellea.core import AudioBlock

with start_session(
    "openai",
    model_id="my-audio-model",
    base_url="http://localhost:8088/v1",
    api_key="default",  # local servers ignore it, but one is required
) as session:
    result = session.instruct(
        "Explain what is in this recording using bullet points",
        audio=[AudioBlock.from_file("meeting.wav")],
        strategy=None,
    )
    print(result.value)
```

`AudioBlock.from_file()`, `from_url()` and `from_bytes()` all detect the format
from the data itself rather than trusting a file extension
([#1601](https://github.com/generative-computing/mellea/pull/1601)). For a clip
you reuse across turns, pass an `AudioUrlBlock` instead and the download is
deferred and cached per URL. A backend that cannot accept audio now tells you
before the request goes out
([#1410](https://github.com/generative-computing/mellea/pull/1410)). Images got
the same treatment, including a `make_image_block()` helper
([#1377](https://github.com/generative-computing/mellea/pull/1377)).

`m serve` handles audio too
([#1443](https://github.com/generative-computing/mellea/pull/1443)). There are
two worked examples: a single call through llama-server, and a two-step Granite
path on Ollama that transcribes first, then queries the transcription with a
requirement checking the result. Both are in
[`docs/examples/m_serve/multimodal-audio/`](https://github.com/generative-computing/mellea/tree/v0.8.0/docs/examples/m_serve/multimodal-audio),
and the plain session examples are in
[`docs/examples/audio_text_models/audio_examples.py`](https://github.com/generative-computing/mellea/blob/v0.8.0/docs/examples/audio_text_models/audio_examples.py).

## Files out of the sandbox

v0.7.0 gave agents a sandboxed Python interpreter, which was useful right up to
the moment the generated code produced a file. Plots, CSVs, trained models: all
of it stayed in the container, and retrieving it was your problem.

A successful local-tier run now returns files from the tool's working directory
on the result, as `ExecutionResult.artifacts`
([#1384](https://github.com/generative-computing/mellea/pull/1384)). Docker-backed
tools can export container paths the same way, for the paths you list in
`CapabilityPolicy.artifact_export_paths`, and only when the environment is used
as a context manager rather than one-shot.

## A much faster CLI

Top-level imports had leaked into the `m` entry point, so every invocation paid
to load the whole library. With them removed, `m --help` goes from 3.170s to
0.113s, as measured in
[#1537](https://github.com/generative-computing/mellea/pull/1537). If you use
the CLI interactively, this is probably the change you will feel most.

## Streaming you drive yourself

The old API asked you to track two things: the stream you iterated, and a
background task you eventually awaited. Forgetting `acomplete()` leaked that
task, and so did breaking out of the loop early.

`stream()` is one object you consume directly, and `async with` cancels the
generation on every exit path, including an early `break`
([#1543](https://github.com/generative-computing/mellea/pull/1543),
[#1567](https://github.com/generative-computing/mellea/pull/1567)):

```python
async with await stream(
    action, backend, ctx, requirements=[req], chunking="sentence"
) as streamer:
    async for chunk in streamer:
        print(chunk)
```

Typed events come from the same call with `as_events=True`, and the event
vocabulary is unchanged. There is also a new `streamer.completed_normally`,
which unlike `not streamer.failed_early` is `False` after an early `break`.

## Validation at the granularity each check needs

A stream has one chunk boundary, but requirements do not all want the same one.
"No sentence exceeds twelve words" needs whole sentences; a banned-word check
wants single words. Previously both had to share the stream's setting.

Each `Requirement` can now declare its own
([#1630](https://github.com/generative-computing/mellea/pull/1630)):

```python
class MaxWordsPerSentence(Requirement):
    def __init__(self, limit: int = 12) -> None:
        super().__init__(description="keep sentences short", chunking="sentence")
        self._limit = limit

    async def _stream_validate(
        self, chunk: str, *, backend: Backend, ctx: Context
    ) -> PartialValidationResult:
        words = len(chunk.split())
        if words > self._limit:
            return PartialValidationResult(
                "fail", reason=f"sentence has {words} words (> {self._limit})"
            )
        return PartialValidationResult("unknown")
```

Sentence-level and word-level checks can now validate the same stream at once.
Full version:
[`per_requirement_chunking.py`](https://github.com/generative-computing/mellea/blob/v0.8.0/docs/examples/streaming/per_requirement_chunking.py).

## Register your own adapter

If you have trained your own aLoRA or PEFT adapter, you can now register it
directly ([#1619](https://github.com/generative-computing/mellea/pull/1619)):

```python
from mellea.backends.adapters import Adapter, Identity, LocalFileBinding, get_io_contract
from mellea.backends.adapters.catalog import AdapterType
from mellea.backends.huggingface import LocalHFBackend

backend = LocalHFBackend(model_id="ibm-granite/granite-4.1-3b")
backend.add_adapter(
    Adapter(
        identity=Identity(name="custom-failure-check", adapter_type="alora"),
        io_contract=get_io_contract("custom-failure-check"),
        weights=LocalFileBinding(
            name="custom-failure-check",
            adapter_type=AdapterType.ALORA,
            repo_id="your-org/my-adapter",
            revision="main",  # or a commit SHA to fix it to one version
        ),
    )
)
```

Two things to get right. `revision` has to be set, because a custom name has no
catalog entry to fall back on; `"main"` follows the latest commit, and a full
commit SHA fixes it to one version. And match the base `model_id` to whatever your adapter was
trained against. Granite 4.1 is the current base for adapter work, since the
public catalogs have no 4.2 weights yet. Note also that `Identity` takes
`adapter_type` as a plain string while the binding takes the `AdapterType` enum.
The walkthrough is
[tutorial 07](https://github.com/generative-computing/mellea/blob/v0.8.0/docs/docs/tutorials/07-custom-adapter-function.md),
with [tutorial 08](https://github.com/generative-computing/mellea/blob/v0.8.0/docs/docs/tutorials/08-adapter-schema-migrations.md)
on schema migrations.

Adapters also reach further this release: embedded adapters work on
`LocalHFBackend` ([#1593](https://github.com/generative-computing/mellea/pull/1593))
and Ollama gained adapter functions
([#1634](https://github.com/generative-computing/mellea/pull/1634)), so
intrinsics that previously needed a vLLM-served model now run locally.

## Granite 4.2 by default

Granite 4.2 3B is the new default local text model for `start_session`,
`OllamaModelBackend` and `LiteLLMBackend`, with `granite-4.2-3b`, `-8b` and
`-30b` identifiers available for Hugging Face and Ollama
([#1587](https://github.com/generative-computing/mellea/pull/1587)). It thinks
by default, so `ModelOption.THINKING: False` now sends
`reasoning_effort="none"` on OpenAI-compatible and LiteLLM backends, scoped to
self-hosted targets because OpenAI's own reasoning models reject that value.

Two exceptions: adapter functions stay on Granite 4.1, because the public
adapter catalogs publish no 4.2 weights yet, and vision stays on Granite Vision
4.1. This release updates the dense text model only.

## What your traces show now

Past the renames listed under breaking changes, two things become visible that
were not before. Tool execution gets its own spans
([#1430](https://github.com/generative-computing/mellea/pull/1430)), so a
tool-calling loop shows individual calls rather than one opaque generation. And
sampling and validation are traced
([#1488](https://github.com/generative-computing/mellea/pull/1488)), so an
instruct-validate-repair cycle appears as a trace instead of something you
reconstruct from logs. Streaming latency is now measured at provider receipt
([#1631](https://github.com/generative-computing/mellea/pull/1631)), so
time-to-first-chunk reflects the provider rather than Mellea's own overhead.

## Also worth knowing

`m serve` can now use the model name your OpenAI client sends rather than
overriding it, if your served function declares a `client_options` parameter to
receive it; routing on that value is up to your code
([#1512](https://github.com/generative-computing/mellea/pull/1512)). `call_tools`
is public, so you can drive a tool loop yourself
([#1544](https://github.com/generative-computing/mellea/pull/1544)). Tool calls
survive multi-turn history more reliably, and tool results now reach
OpenAI-compatible providers in the shape those providers expect. Several errors
are more specific than they were, including validation parse failures and
adapter schema mismatches, which used to fail obscurely.

The rest is maintenance you get for free: imports are faster,
resource leaks on backend clients and worker threads are fixed, and the
`langchain-core` and `litellm` floors were raised to clear a CVE
([#1447](https://github.com/generative-computing/mellea/pull/1447)). Docs gained
guidance on choosing between validation approaches
([#1540](https://github.com/generative-computing/mellea/pull/1540)) and a
rewritten aLoRA example on the intrinsics API.

## Breaking changes

These are the ones most people hit, usually one or two of them.

| What changed | Who is affected | What to do | PR |
| --- | --- | --- | --- |
| `stream_with_chunking()` becomes `stream()`, consumed with `async for` on your own task. `chunking` defaults to `None`, not `"sentence"`. Strategy classes renamed `...Chunker` to `...Chunking`, now in `mellea.core.chunking`. | Streaming with validation | Follow the [migration guide](https://github.com/generative-computing/mellea/blob/v0.8.0/docs/dev/migrate-streaming-v0.8.md) | [#1543](https://github.com/generative-computing/mellea/pull/1543) |
| Span attributes and client metrics renamed to the OpenTelemetry GenAI conventions. Old names removed, no dual-emit. | Every dashboard, alert and query | Rebuild queries from the [observability docs](https://github.com/generative-computing/mellea/tree/v0.8.0/docs/docs/observability) | [#1551](https://github.com/generative-computing/mellea/pull/1551) |
| `ModelOutputThunk.tool_calls` is a list, not a dict keyed by tool name. The dict silently dropped parallel calls to one tool. | Anyone reading `tool_calls` by key | Iterate it. Repeat calls are now visible | [#1435](https://github.com/generative-computing/mellea/pull/1435) |
| Direct `act()`/`aact()` calls with `requirements=` and `strategy=None` raise `ValueError`. Those checks never ran. `instruct()` forwards them only when a strategy exists, so it is unaffected. | Direct `act()`/`aact()` callers | Add a strategy, or attach the requirements to the action | [#1468](https://github.com/generative-computing/mellea/pull/1468) |
| On `LocalHFBackend`, `load_adapter()` and `unload_adapter()` are now `load_peft_adapter()` and `unload_peft_adapter()`. `list_adapters()` returns registered, not loaded, adapters. | Direct callers of adapter verbs | Rename both. For Granite Switch use `EmbeddedBinding.apply_activation()` | [#1422](https://github.com/generative-computing/mellea/pull/1422) |
| `m fix async` is gone. `m fix genslots` is unaffected. | Scripts or CI calling it | Drop it, or run it from v0.7.0 first | [#1537](https://github.com/generative-computing/mellea/pull/1537) |
| Per-chunk streaming telemetry moved onto the backend span, and is opt-in. | Consumers of streaming telemetry | Set `MELLEA_GENERATION_CHUNK_EVENTS=true` | [#1496](https://github.com/generative-computing/mellea/pull/1496) |

Smaller breaks, if you subclass or instrument Mellea: `Requirement.stream_validate()`
is now `@final`, so a custom requirement overrides `_stream_validate()` instead
([#1543](https://github.com/generative-computing/mellea/pull/1543)); `QuickCheckEvent.results` holds `PartialValidationSummary`
rather than `PartialValidationResult` (same PR); the public `record_*` telemetry
helpers take a required `operation` argument ([#1551](https://github.com/generative-computing/mellea/pull/1551)); and the deprecated
`rag.check_context_relevance()` is removed ([#1579](https://github.com/generative-computing/mellea/pull/1579)).

Telemetry has now been renamed two releases running, after v0.7.0's
`MELLEA_TRACE_*` to `MELLEA_TRACES_*` change. Tracing is pre-1.0 and moving
towards the OpenTelemetry spec, so expect one more settling release before
treating these names as fixed.

## Upgrading

```bash
pip install --upgrade mellea
```

Check [breaking changes](#breaking-changes) first. The two worth most of your
attention are
streaming, which has a [full migration
guide](https://github.com/generative-computing/mellea/blob/v0.8.0/docs/dev/migrate-streaming-v0.8.md),
and telemetry, where the old names are gone rather than deprecated.

The [full release
notes](https://github.com/generative-computing/mellea/releases/tag/v0.8.0) list
all 134 PRs, including first contributions from nine new people.

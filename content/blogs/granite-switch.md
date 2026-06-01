---
title: "Granite Switch in Mellea: intrinsics without adapter wrangling"
date: "2026-06-01"
author: "Nigel Jones"
excerpt: "Granite Switch bakes a curated set of Granite intrinsics into a single vLLM-served checkpoint. From a Mellea program, calling answerability or hallucination detection looks exactly the same as before — but there are no adapter binaries to download or version to track."
tags: ["granite", "intrinsics", "adapters", "switch", "vllm"]
---

<img src="/images/granite-switch/main.svg" alt="Granite Switch in Mellea — one checkpoint serving multiple intrinsics" style="background-color: white;" />

Running Mellea intrinsics on Granite today means managing adapter weights. You pick
the right `granitelib-*` repo, download a PEFT checkpoint, keep it version-aligned
with your base model, load and unload it at inference time. For a handful of
intrinsics on a single host this is fine. Add more intrinsics, scale to more hosts,
or roll out a new base model version, and you're spending real time on adapter
logistics rather than on the application.

Granite Switch removes that overhead. A Switch checkpoint is a single set of Granite
4.1 weights with a curated collection of intrinsics baked in. Your Mellea program
calls the same `rag.check_answerability(...)` or `rag.flag_hallucinated_content(...)`
it always did — the right adapter activates via a control token injected by the chat
template. No adapter binaries to download. No version tracking across adapters and
base model. One checkpoint to serve.

> **What this post does**: introduces Granite Switch and shows it running two
> intrinsics — answerability checking and hallucination detection — through Mellea's
> OpenAI-compatible backend against a local vLLM instance. All code snippets are from
> `docs/examples/granite-switch/` in the Mellea repository.

## Intrinsics and Switch: what each one is

**Intrinsics** are the capability: small task-specific adapters over a Granite base
model that answer questions like "can these documents answer this question?"
(`check_answerability`), "which sentences in this response aren't grounded in the
retrieved documents?" (`flag_hallucinated_content`), "does this output meet this
requirement?" (`core.requirement_check`), and more. They ship as the
`granitelib-{rag,core,guardian}` adapter collections on Hugging Face. They landed in
Mellea in version 0.4.0.

**Granite Switch** is one way to deliver those intrinsics. Instead of downloading
adapter weights from `ibm-granite/granitelib-*` and loading them at runtime with
PEFT, Switch publishes a single checkpoint
(`ibm-granite/granite-switch-4.1-3b-preview`, also 8B and 30B) that contains a
curated subset of those intrinsic adapters directly in the model weights. Adapter
selection happens through a control token that vLLM injects via the chat template.
No PEFT machinery, no adapter hot-swap.

The trade-off is direct: Switch is operationally simpler and works with any
OpenAI-compatible runtime. The PEFT path gives you the full Granite Libraries,
including adapters not yet embedded in a Switch checkpoint.

## Setting it up

Start the model with vLLM:

```bash
vllm serve ibm-granite/granite-switch-4.1-3b-preview \
    --dtype bfloat16 --enable-prefix-caching
```

Install Mellea with the switch extra:

```bash
pip install mellea[switch]
```

> **Reviewer note:** vLLM on Linux is the documented, validated path and is what
> the examples above use. macOS-native alternatives that also support
> `chat_template_kwargs` — `omlx` and `vmlx` (both Apple Silicon MLX servers) —
> are being investigated but have not yet been validated against Granite Switch 4.1.
> Before publishing, run the examples end-to-end against at least one validated
> runtime and expand this section if a macOS path is confirmed. Remove this note
> before merge.

## Running answerability and hallucination detection

The backend setup is one block of code. After that, calling different intrinsics is
just calling different functions.

```python
from mellea.backends.model_ids import IBM_GRANITE_SWITCH_4_1_3B_PREVIEW
from mellea.backends.openai import OpenAIBackend
from mellea.formatters import TemplateFormatter
from mellea.stdlib.components import Document, Message
from mellea.stdlib.components.intrinsic import rag
from mellea.stdlib.context import ChatContext

MODEL = IBM_GRANITE_SWITCH_4_1_3B_PREVIEW.hf_model_name
backend = OpenAIBackend(
    model_id=MODEL,
    formatter=TemplateFormatter(model_id=MODEL),
    base_url="http://localhost:8000/v1",
    api_key="EMPTY",
    load_embedded_adapters=True,
)
```

The `load_embedded_adapters=True` flag tells Mellea to fetch the I/O configuration
files for each intrinsic from the Hugging Face model repo — a few kilobytes of YAML,
not adapter weights — and register the embedded adapters automatically.

Now run answerability:

```python
ctx = ChatContext().add(Message("assistant", "How can I help you?"))
docs = [Document("The square root of 4 is 2.")]

print(rag.check_answerability("What is the square root of 4?", docs, ctx, backend))
# → "answerable"

print(rag.check_answerability("What is the capital of France?", docs, ctx, backend))
# → "unanswerable"
```

The same backend object runs hallucination detection without any change to the setup:

```python
context = (
    ChatContext()
    .add(Message("assistant", "Hello there, how can I help you?"))
    .add(Message("user", "Tell me about some yellow fish."))
)
response = "Purple bumble fish are yellow. Green bumble fish are also yellow."
documents = [Document("The only type of fish that is yellow is the purple bumble fish.")]

flagged = rag.flag_hallucinated_content(response, documents, context, backend)
for sentence in flagged:
    print(f"{sentence['faithfulness']:12}  {sentence['response_text']}")
```

Output:

```text
FAITHFUL      Purple bumble fish are yellow.
UNFAITHFUL    Green bumble fish are also yellow.
```

Two sentences, two verdicts. The record for each sentence includes `faithfulness`,
`response_text`, character offsets into the original response, and a brief
explanation from the model. Nothing in the calling code changes depending on which
intrinsic you're running — the dispatch happens inside `OpenAIBackend`.

## What it costs to ship

With the PEFT path, a production deployment needs adapter binaries on disk for each
intrinsic, version-pinned to the base model checkpoint. Each time IBM updates the
Granite Libraries, you rebuild and redeploy.

With Switch, you serve one model. Mellea's client downloads small I/O configuration
files — `adapter_index.json` and per-adapter `io.yaml` — to understand how to format
requests and parse responses. The adapter itself is already in the model weights; the
selection is a control token that vLLM handles through the chat template. The code
path on the Mellea side is `EmbeddedIntrinsicAdapter` in
`mellea/backends/adapters/adapter.py`.

## Where this is going

The current integration lives in `OpenAIBackend` because vLLM provides the
chat-template mechanism needed to inject control tokens. That's also what makes the
architecture promising for the future: anything that speaks OpenAI-compatible chat
completions and honours `chat_template_kwargs` can, in principle, serve a Switch
model.

Two things are in active development. Issue
[#1018](https://github.com/generative-computing/mellea/issues/1018) adds Switch
support to `LocalHFBackend`, which means running Switch with Hugging Face
Transformers rather than vLLM — useful for local development and for teams that
can't operate a separate serving process. The broader unified-bindings work in
[epic #929](https://github.com/generative-computing/mellea/issues/929) is
refactoring the adapter path so that embedded adapters work the same way across all
backends that support them.

Today, the supported path is `OpenAIBackend` + vLLM. That's the path that's
documented, tested, and ready to use.

## When to reach for Switch vs the PEFT path

|                         | Granite Switch                       | PEFT / LocalHFBackend     |
|-------------------------|--------------------------------------|---------------------------|
| Runtime                 | vLLM (OpenAI-compatible)             | Hugging Face Transformers |
| Adapter weights on disk | No — one checkpoint                  | Yes — one per intrinsic   |
| Adapter set             | Curated (RAG, Core, Guardian subset) | Full Granite Libraries    |
| Status                  | Preview (3B / 8B / 30B)              | Stable                    |

Switch is the simpler path if vLLM is available and the curated adapter set covers
your use case. Use `LocalHFBackend` with the granitelib adapters if you need an
adapter not yet embedded in a Switch checkpoint, or if you can't run vLLM. The
`-preview` label on Switch model IDs reflects IBM's current release status — the
Mellea integration is stable, but the model checkpoints are still in active
development.

## Try it

- **Examples**: [`docs/examples/granite-switch/`](https://github.com/generative-computing/mellea/tree/main/docs/examples/granite-switch) — runnable examples for answerability, hallucination detection, and manual adapter loading
- **Docs**: [Intrinsics with Granite Switch](https://docs.mellea.ai/integrations/openai#intrinsics-with-granite-switch) in the OpenAI backend reference
- **Model card**: [`ibm-granite/granite-switch-4.1-3b-preview`](https://huggingface.co/ibm-granite/granite-switch-4.1-3b-preview) — architecture details and the full list of embedded adapters
- **Install**: `pip install mellea[switch]`, then `vllm serve ibm-granite/granite-switch-4.1-3b-preview --dtype bfloat16 --enable-prefix-caching`

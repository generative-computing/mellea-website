---
title: "Granite Switch in Mellea: intrinsics without adapter wrangling"
date: "2026-06-01"
author: "Nigel Jones"
excerpt: "Granite Switch bakes a curated set of Granite intrinsics into a single vLLM-served checkpoint. From a Mellea program, calling answerability or hallucination detection looks exactly the same as before — but there are no adapter binaries to download or version to track."
tags: ["granite", "intrinsics", "adapters", "switch", "vllm"]
---

<img src="/images/granite-switch/main.svg" alt="Granite Switch in Mellea — one checkpoint serving multiple intrinsics" style="background-color: white;" />

Running Mellea intrinsics on Granite today means managing adapter weights. For every
capability you want — answerability checking, hallucination detection, citations,
requirement validation — you pick the right `granitelib-*` repo, download a PEFT
checkpoint, and keep it version-aligned with your base model. For a handful of
intrinsics on a single host this is manageable. Add more intrinsics, scale to more
hosts, or roll out a new base model version, and you're maintaining a matrix of
adapter files rather than building your application.

Granite Switch collapses that matrix. A Switch checkpoint is a single set of Granite
4.1 weights with twelve-plus intrinsics baked in. Your Mellea program calls the same
`rag.check_answerability(...)` or `rag.flag_hallucinated_content(...)` it always did
— the right adapter fires via a control token injected by the chat template. One model
to serve. Zero adapter files to manage. And as you scale your serving fleet, every
host automatically has every embedded intrinsic — no per-host adapter sync required.

> **What you'll need:** vLLM serving `ibm-granite/granite-switch-4.1-3b-preview` and
> `pip install 'mellea[switch]'`. All snippets are in
> [`docs/examples/granite-switch/`](https://github.com/generative-computing/mellea/tree/main/docs/examples/granite-switch).

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

The trade-off is direct: Switch eliminates adapter lifecycle management entirely —
one checkpoint, all embedded intrinsics, no per-intrinsic weight files, no version
matrix. The PEFT path gives you the full Granite Libraries, including adapters not
yet in a Switch checkpoint — it's the right choice when you need something outside
the curated set.

## Setting it up

The `granite-switch` plugin package registers the `GraniteSwitchForCausalLM`
architecture with vLLM. Without it, vLLM refuses to load the model with
`Model architectures ['GraniteSwitchForCausalLM'] are not supported`. Install
the variant that matches your vLLM and CUDA versions:

```bash
pip install "granite-switch[vllm20]"   # vLLM 0.20+ / CUDA 13+
pip install "granite-switch[vllm]"     # vLLM 0.19.x / CUDA 12.x
```

Start the model with tool-call parsing enabled — this is required for adapter
selection; without it the model loads but intrinsics won't dispatch:

```bash
vllm serve ibm-granite/granite-switch-4.1-3b-preview \
    --enable-auto-tool-choice \
    --tool-call-parser granite4
```

No `--trust-remote-code`, no quantization flags, no custom chat template — the
adapters activate via control tokens already in the model's bundled template.

Install Mellea with the switch extra:

```bash
pip install 'mellea[switch]'
```

> **Reviewer note:** vLLM on Linux with the above steps is the validated path.
> macOS alternatives that support `chat_template_kwargs` — `omlx` and `vmlx` (both
> Apple Silicon MLX servers) — are being investigated but have not yet been validated
> against Granite Switch 4.1. Expand this section if a macOS path is confirmed before
> merge.

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
faithful      Purple bumble fish are yellow.
unfaithful    Green bumble fish are also yellow.
```

Two sentences, two verdicts. The record for each sentence includes `faithfulness`,
`response_text`, character offsets into the original response, and a brief
explanation from the model. Nothing in the calling code changes depending on which
intrinsic you're running — the dispatch happens inside `OpenAIBackend`.

## What it costs to ship

With the PEFT path, every intrinsic you ship is a binary on disk — version-pinned to
the base model, replicated across every host, and rebuilt each time IBM updates the
Libraries. Five intrinsics across ten hosts means fifty artifact slots in your
deployment pipeline.

With Switch, you pull one model and you're done. Mellea's client downloads a few
kilobytes of I/O configuration — `adapter_index.json` and per-adapter `io.yaml` — to
understand how to format requests and parse responses. No adapter weights are
transferred; they are already part of the model. Adding a new intrinsic to your
application is a code change, not an infrastructure change. The relevant code path on
the Mellea side is `EmbeddedIntrinsicAdapter` in
`mellea/backends/adapters/adapter.py`.

## Where this is going

The current integration lives in `OpenAIBackend` because vLLM provides the
chat-template mechanism needed to inject control tokens. That's also what makes the
architecture compelling for the future: the dispatch mechanism is just a request
parameter — anything that speaks OpenAI-compatible chat completions and honours
`chat_template_kwargs` can serve a Switch model. No new protocol. No special client
library. Just a model that knows how to route.

That opens a clear path to broad runtime support. Issue
[#1018](https://github.com/generative-computing/mellea/issues/1018) adds Switch
support to `LocalHFBackend` — running Switch with Hugging Face Transformers for local
development and embedded deployments. The broader unified-bindings work in
[epic #929](https://github.com/generative-computing/mellea/issues/929) is
refactoring the adapter path so embedded adapters work identically across every
backend that supports them. When that lands, Switch intrinsics will follow the same
code path whether you're running vLLM in production or Transformers on a laptop.

Today, the supported path is `OpenAIBackend` + vLLM. That's the path that's
documented, tested, and ready to use.

## When to reach for Switch vs the PEFT path

|                         | Granite Switch                       | PEFT / LocalHFBackend     |
|-------------------------|--------------------------------------|---------------------------|
| Runtime                 | vLLM                                 | Hugging Face Transformers |
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
- **Install**: `pip install "granite-switch[vllm20]"` (server-side plugin), `pip install 'mellea[switch]'` (client), then `vllm serve ibm-granite/granite-switch-4.1-3b-preview --enable-auto-tool-choice --tool-call-parser granite4`

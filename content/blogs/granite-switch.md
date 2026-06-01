---
title: "Granite Switch in Mellea: intrinsics without adapter wrangling"
date: "2026-06-01"
author: "Nigel Jones"
excerpt: "With Granite Switch, adding validation to a Mellea program — checking that an answer is grounded, that a requirement is met, that nothing in the response was hallucinated — is a single function call against the backend you're already using. One checkpoint, a dozen drop-in validations, no second pipeline to stand up."
tags: ["granite", "intrinsics", "adapters", "switch", "vllm"]
---

<img src="/images/granite-switch/main.svg" alt="Granite Switch in Mellea — one checkpoint serving multiple intrinsics" style="background-color: white;" />

Imagine you're writing a Mellea program and the model has just produced a
response. You want to validate it: is the answer grounded in the documents
you retrieved? Does it satisfy the requirements you set? Is anything in the
output hallucinated? Each of those checks would normally mean standing up a
separate validation pipeline — a second model call with a tuned prompt, an
LLM-as-judge harness, sometimes a classifier you trained yourself.

Granite Switch makes every one of those validations a single function call
against the backend you're already using:

```python
from mellea.stdlib.components.intrinsic import rag, core

rag.check_answerability(question, documents, context, backend)
rag.flag_hallucinated_content(response, documents, context, backend)
core.requirement_check(context, backend, requirement)
```

Same shape every time — swap the function name, get a different validation.
One Granite Switch checkpoint serves a dozen of these: answerability,
hallucination detection, requirement checks, citations, query rewriting, and
more. Adding a validation step to your program is a code change, not an
infrastructure change.

> **What you'll need:** the `granite-switch` plugin package and vLLM on the server
> side (see setup below); `pip install 'mellea[switch]'` in your application
> environment. All snippets are in
> [`docs/examples/granite-switch/`](https://github.com/generative-computing/mellea/tree/main/docs/examples/granite-switch).

## How it works

Granite Switch is a single Granite 4.1 checkpoint
(`ibm-granite/granite-switch-4.1-3b-preview`, also 8B and 30B) with a
curated set of validation capabilities baked directly into the model
weights — and crucially, the *routing* between them is baked in too.
This is the architectural shift that makes the simplicity above
possible. With LoRA hot-swap, an orchestration layer outside the model
loads the right adapter for each call. With LLM-as-judge, you write a
second prompt and run the model again. With Granite Switch, the model
already knows how to be every one of these validators; you just tell
it which one to be for this call.

That signal is a control token in the chat template, set by Mellea
when you call an intrinsic function in
`mellea.stdlib.components.intrinsic.{rag,core,guardian}`. No second
model to run, no adapter hot-swap, no eval pipeline to orchestrate
around your program. You serve one checkpoint and pick the behaviour
you want.

## Setting it up

The [`granite-switch`](https://pypi.org/project/granite-switch/) plugin package
registers the `GraniteSwitchForCausalLM`
architecture with vLLM. Without it, vLLM refuses to load the model with
`Model architectures ['GraniteSwitchForCausalLM'] are not supported`. Install it
in your **vLLM server environment**, matching your vLLM and CUDA versions:

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

Install Mellea in your **application environment**:

```bash
pip install 'mellea[switch]'
```

> **Reviewer note:** vLLM on Linux with the above steps is the validated path.
> Switch doesn't run under Ollama, so a macOS option is still being investigated —
> nothing confirmed yet. Expand this section if a macOS path lands before merge.

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
    api_key="EMPTY",  # vLLM doesn't validate API keys — any string works
    load_embedded_adapters=True,
)
```

The `load_embedded_adapters=True` flag tells Mellea to fetch the I/O configuration
files for each intrinsic from the Hugging Face model repo — a few kilobytes of JSON
and YAML, not adapter weights — and register the embedded adapters automatically.

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

## When this fits

Granite Switch is the simplest path when you can run vLLM and the
curated validation set covers what you need. The same capabilities are
also available as standalone adapters through Mellea's `LocalHFBackend`
if you need something outside the curated set — see the [intrinsics
overview](https://docs.mellea.ai/advanced/intrinsics) for the full
picture. Switch model IDs are labelled `-preview`, which makes it a
great fit for prototyping and evaluation today.

## Try it

- **Mellea**: [generative-computing/mellea](https://github.com/generative-computing/mellea) — repo, issues, releases
- **Examples**: [`docs/examples/granite-switch/`](https://github.com/generative-computing/mellea/tree/main/docs/examples/granite-switch) — runnable examples for answerability, hallucination detection, and manual adapter loading
- **Docs**: [Intrinsics with Granite Switch](https://docs.mellea.ai/integrations/openai#intrinsics-with-granite-switch) in the OpenAI backend reference, and the [intrinsics overview](https://docs.mellea.ai/advanced/intrinsics) for the full capability surface
- **Model card**: [`ibm-granite/granite-switch-4.1-3b-preview`](https://huggingface.co/ibm-granite/granite-switch-4.1-3b-preview) — architecture details and the full list of embedded adapters
- **Install**: `pip install "granite-switch[vllm20]"` (server-side plugin), `pip install 'mellea[switch]'` (client), then `vllm serve ibm-granite/granite-switch-4.1-3b-preview --enable-auto-tool-choice --tool-call-parser granite4`

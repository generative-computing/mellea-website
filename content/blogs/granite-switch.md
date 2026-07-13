---
title: "Granite Switch in Mellea: one checkpoint, every adapter function"
date: "2026-06-16"
author: "Nigel Jones"
excerpt: "With Granite Switch, adding validation to a Mellea program — checking that an answer is grounded, that a requirement is met, that nothing in the response was hallucinated — is a single function call against the backend you're already using. One checkpoint, a dozen drop-in validations, no second pipeline to stand up."
tags: ["granite", "adapters", "switch", "vllm"]
---

<img src="/images/granite-switch/main.svg" alt="Granite Switch in Mellea — one checkpoint serving multiple adapter functions" style="background-color: white;" />

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

> **What you'll need:** The `granite-switch` plugin, vLLM on a GPU server with `--enable-prefix-caching`, and `pip install "mellea[switch]"` (see setup below). The client code runs on macOS or Linux. All snippets are in the mellea repo at [`docs/examples/granite-switch/`](https://github.com/generative-computing/mellea/tree/main/docs/examples/granite-switch).

## How it works

Granite Switch is a single Granite 4.1 base model (`ibm-granite/granite-switch-4.1-3b-preview`, also 8B and 30B) with
a switching layer and a curated set of validation capabilities — called *adapter functions* — embedded in
the model weights, and crucially, the *routing* between them is baked in too.
This is the architectural shift that makes the simplicity above
possible. With LoRA hot-swap, an orchestration layer outside the model
loads the right adapter for each call. With LLM-as-judge, you write a
second prompt and run the model again. With Granite Switch, the model
already knows how to be every one of these validators; you just tell
it which one to be for this call.

That signal is a control token in the chat template, set by Mellea
when you call an adapter function in `mellea.stdlib.components.intrinsic`
(`rag`, `core`, or `guardian`). No second
model to run, no adapter hot-swap, no eval pipeline to orchestrate
around your program. You serve one Granite Switch checkpoint and pick the behaviour
you want.

The performance advantage goes beyond convenience. Standard LoRA
hot-swap clears the KV cache on every adapter switch — multi-step
pipelines that check answerability, then generate, then verify
hallucinations have to recompute context from scratch at each step.
Granite Switch uses activated LoRA (aLoRA), where the adapter only
activates from the control token onward, so the base-model KV cache
stays valid and reusable. Context carries forward across adapter
function calls without recomputation, which matters when you're
chaining several validators in a single request.
The accuracy improvement is real too: on IFEval, prompting the base
Granite 4.1 3B model for requirement checking achieves 51% balanced
accuracy; the embedded requirement-check adapter [reaches 84%](https://research.ibm.com/blog/granite-libraries-project-switch).

## Setting it up

Granite Switch requires vLLM for inference — it uses a custom
`GraniteSwitchForCausalLM` architecture that only vLLM supports, via the
[`granite-switch`](https://pypi.org/project/granite-switch/) plugin. Without it,
vLLM refuses to load the model with
`Model architectures ['GraniteSwitchForCausalLM'] are not supported`.
The client code runs on macOS or Linux.

Install the `granite-switch` plugin in your **vLLM server environment**:

```bash
pip install "granite-switch[vllm]"
```

Then start the model with prefix caching enabled:

```bash
vllm serve ibm-granite/granite-switch-4.1-3b-preview --port 8000 \
  --dtype bfloat16 --enable-prefix-caching
```

No `--trust-remote-code`, no quantization flags, no custom chat template.

Install Mellea in your **application environment**:

```bash
pip install "mellea[switch]"
```

## Running answerability and hallucination detection

Set up the backend, then call adapter functions against it:

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
    api_key="EMPTY",  # a local vLLM server doesn't validate API keys — any string works
    load_embedded_adapters=True,
)
```

The `load_embedded_adapters=True` flag tells Mellea to fetch the adapter I/O configuration
files (a few kilobytes of JSON and YAML) from the Hugging Face model repo; the adapter
weights themselves are already built into the served checkpoint.

Now run answerability:

```python
context = ChatContext().add(Message("assistant", "How can I help you?"))
docs = [Document("The square root of 4 is 2.")]

print(rag.check_answerability("What is the square root of 4?", docs, context, backend))
print(rag.check_answerability("What is the capital of France?", docs, context, backend))
```

Output:

```text
answerable
unanswerable
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
`response_text`, character offsets, and a brief explanation from the model.
Nothing in the calling code changes depending on which
adapter function you're running.

## When this fits

Granite Switch is the right choice when your program chains several validation
steps — answerability, hallucination detection, requirement checking — and you
want them all against one checkpoint with KV cache reuse between steps (enabled by
`--enable-prefix-caching`). The
alternative is a separate model call per validator. Model IDs are labelled
`-preview` — solid for prototyping and evaluation today.
For the full adapter surface, see the [adapter functions
overview](https://docs.mellea.ai/advanced/intrinsics).

## Try it

- **Mellea**: [generative-computing/mellea](https://github.com/generative-computing/mellea) — repo, issues, releases
- **Examples**: [`docs/examples/granite-switch/`](https://github.com/generative-computing/mellea/tree/main/docs/examples/granite-switch) — runnable examples for answerability, hallucination detection, and manual adapter loading
- **Docs**: [Intrinsics with Granite Switch](https://docs.mellea.ai/integrations/openai#intrinsics-with-granite-switch) in the OpenAI backend reference, and the [adapter functions overview](https://docs.mellea.ai/advanced/intrinsics) for the full capability surface
- **Model card**: [`ibm-granite/granite-switch-4.1-3b-preview`](https://huggingface.co/ibm-granite/granite-switch-4.1-3b-preview) — architecture details and the full list of embedded adapters
- **Install**: `pip install "granite-switch[vllm]"` (server-side plugin), `pip install "mellea[switch]"` (client), then `vllm serve ibm-granite/granite-switch-4.1-3b-preview --port 8000 --dtype bfloat16 --enable-prefix-caching`

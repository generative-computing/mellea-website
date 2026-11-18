---
title: "LLMON support comes to Mellea v0.9.0"
date: "2026-11-19"
author: "Mellea Contributors"
excerpt: "Mellea v0.9.0 adds support for LLMON, an experimental markup language that lets trained models tell your instructions apart from the data they read. The release also brings reliability fixes for validation, aLoRA adapters, and tool calling."
tags: ["release", "v0.9", "llmon"]
---

Mellea v0.9.0, released on November 12, 2026, adds support for LLMON (LLM
Object Notation), which
[launched the same day](https://huggingface.co/blog/ibm-granite/llmon-an-llm-native-markup-language-now-in-granite)
as an experimental preview. LLMON is a markup language that models are trained on to
keep instructions, data, and requirements in separate, labeled blocks, which
reduces the risk of prompt injection. Mellea already knows which part of a
component is which, so with an LLMON model it passes that structure through
without you writing any markup.

The release also includes reliability fixes for validation, aLoRA adapters,
and tool calling, plus smaller improvements. If you use SOFAI with a judge,
register your own aLoRA, or write custom sampling strategies, read
[behavior changes](#behavior-changes) before you upgrade.

## LLMON support

With an LLMON model, your code looks the same as it does with any other model.
`LocalHFBackend` switches to the new `LLMONFormatter` automatically for the two
Granite preview models,
[`granite-4.1-3b-llmon-preview`](https://huggingface.co/ibm-granite/granite-4.1-3b-llmon-preview)
and
[`granite-4.1-8b-llmon-preview`](https://huggingface.co/ibm-granite/granite-4.1-8b-llmon-preview),
which are also available as `IBM_GRANITE_4_1_3B_LLMON_PREVIEW` and
`IBM_GRANITE_4_1_8B_LLMON_PREVIEW` in `mellea.backends.model_ids`:

```python
import mellea
from mellea.backends.huggingface import LocalHFBackend
from mellea.stdlib.context import ChatContext

MODEL_ID = "ibm-granite/granite-4.1-3b-llmon-preview"

m = mellea.MelleaSession(backend=LocalHFBackend(model_id=MODEL_ID), ctx=ChatContext())

thunk = m.instruct(
    "Summarize this customer feedback in one sentence.",
    grounding_context={"feedback": "loved the product, but shipping was very slow"},
)
print(thunk.value)
```

### What the model receives

The formatter sends each part of a Mellea component in the message fields the
model's chat template turns into LLMON. In the example above, the instruction
becomes an `instr` block and the feedback becomes a `data` block labeled
`feedback`. Requirements become `req` blocks, and documents attached to a
message become `doc` blocks. Content passing through the formatter is
sanitized, so if a retrieved page contains LLMON's own special tokens, it
can't close its `data` block and open an instruction of its own. The reply
comes back as plain text, with no markup to strip.

Structured output with `format=`, tool calling, and requirement validation all
work as usual.

### Current limitations

Like the models, Mellea's LLMON support is a preview, with a few limitations:

- **`LocalHFBackend` only.** Other backends, including vLLM and Ollama, rebuild
  each message from its standard keys and drop the fields LLMON needs. They
  raise `ValueError` for an LLMON model rather than silently sending a prompt
  without its structure.
- **Not every component is supported.** `@generative` functions and
  instructions with an `output_prefix` raise an error.
- **Sanitization covers what passes through the formatter.** A system prompt
  set with `ModelOption.SYSTEM_PROMPT`, tool definitions, and tool-call
  arguments reach the chat template as they are.
- **Use a strategy that repairs.** `LocalHFBackend` decodes greedily, so the
  default `RejectionSamplingStrategy` resends the same prompt and gets the same
  answer. Use `MultiTurnStrategy` or `RepairTemplateStrategy` when you add
  requirements. Check requirements that involve counting, such as an exact word
  count, with a validation function rather than the LLM judge.

To try it, install the `llmon` extra:

```bash
pip install "mellea[hf,llmon]"
```

The
[LLMON concept page](https://github.com/generative-computing/mellea/blob/v0.9.0/docs/docs/concepts/llmon.md)
shows exactly what the model receives, and the full example is
[`instruct_round_trip.py`](https://github.com/generative-computing/mellea/blob/v0.9.0/docs/examples/llmon/instruct_round_trip.py).
We'll take a closer look at LLMON with Mellea in a follow-up post.

## Reliability fixes

- **Async validators run.** `Requirement.validate` now awaits an async
  `validation_fn`, so SOFAI's `judge_backend` and your own async validators
  return real verdicts, and repair and S2 escalation trigger when a requirement
  fails ([#1729](https://github.com/generative-computing/mellea/pull/1729)).
- **aLoRA adapters activate on `LocalHFBackend`.** An aLoRA you register
  yourself with `add_adapter()` is now applied during generation
  ([#1685](https://github.com/generative-computing/mellea/pull/1685)). Mellea
  also checks that the adapter's invocation sequence appears in the prompt
  before the call. If it doesn't, a direct adapter call raises
  `AloraActivationError`, and requirement routing falls back to LLM-as-a-judge
  ([#1684](https://github.com/generative-computing/mellea/pull/1684)). The
  default `core.requirement_check()` and `core.check_certainty()` wrappers use
  a LoRA and are unaffected; the
  [adapter docs](https://github.com/generative-computing/mellea/blob/v0.9.0/docs/docs/advanced/lora-and-alora-adapters.md)
  cover each path.
- **Granite 4.2 tool calls on `LocalHFBackend`.** `parse_tools()` reads Granite
  4.2's XML tool-call format, so the tools run, and a malformed call logs a
  warning ([#1692](https://github.com/generative-computing/mellea/pull/1692)).
- **Tool arguments keep their types.** A `list[int]` arrives as integers,
  Pydantic model elements are validated against their fields, tool schemas
  carry `items` and `Field` constraints such as `minimum`, and optional
  parameters accept `null`
  ([#1694](https://github.com/generative-computing/mellea/pull/1694)).

## Other improvements

- **Prompt templates in traces.** Chat generations emit the OpenInference
  `llm.prompt_template.template` attribute, plus `llm.prompt_template.variables`
  when `MELLEA_TRACES_CONTENT=true`, so a trace shows the template separately
  from the values substituted into it; see the
  [tracing docs](https://github.com/generative-computing/mellea/blob/v0.9.0/docs/docs/observability/tracing.md)
  ([#1672](https://github.com/generative-computing/mellea/pull/1672)).
- **One sampling lifecycle per call.** Every top-level `sample()` now emits
  exactly one sampling lifecycle, whatever the strategy, so hooks and traces
  see SOFAI, budget forcing, and majority voting the same way they see the
  default loop
  ([#1584](https://github.com/generative-computing/mellea/pull/1584)).
- **No more empty prompts.** OpenAI, LiteLLM, and Ollama raise `ValueError`
  before sending a conversation with no user content, instead of letting the
  model ramble at an empty prompt
  ([#1632](https://github.com/generative-computing/mellea/pull/1632)).
- **Ollama model lookup.** `is_model_available()` matches tags
  case-insensitively and in full, so `granite4.1:3b` no longer matches an
  installed `granite4.1:3b-instruct-q4`
  ([#1691](https://github.com/generative-computing/mellea/pull/1691)).
- **OpenAI `reasoning_effort`.** `reasoning_effort="none"` is now omitted for
  real OpenAI servers, which reject it for non-reasoning models
  ([#1709](https://github.com/generative-computing/mellea/pull/1709)).
- **Adapter removal on OpenAI.** `OpenAIBackend.remove_adapter()` unregisters
  an adapter and frees its name for reuse
  ([#1676](https://github.com/generative-computing/mellea/pull/1676)).
- **One `extra_body` merge.** All three merge paths now share the public
  `ModelOption.merge_extra_body`
  ([#1695](https://github.com/generative-computing/mellea/pull/1695)).
- **Docs and examples.** A new example,
  [`llamacpp_session.py`](https://github.com/generative-computing/mellea/blob/v0.9.0/docs/examples/llamacpp_session.py),
  runs Mellea against a local llama.cpp server, with a
  [helper script](https://github.com/generative-computing/mellea/blob/v0.9.0/scripts/start_llamacpp.sh)
  to start one
  ([#1656](https://github.com/generative-computing/mellea/pull/1656)). Example
  READMEs link their files
  ([#1711](https://github.com/generative-computing/mellea/pull/1711)), the
  vision and Ollama examples run reliably in nightly CI
  ([#1671](https://github.com/generative-computing/mellea/pull/1671)), and the
  "Making Agents Reliable" tutorial handles tool results correctly
  ([#1803](https://github.com/generative-computing/mellea/pull/1803)).

## Behavior changes

Some changes in this release can affect existing code.

| What changed | Who is affected | What to do | PR |
| --- | --- | --- | --- |
| `SamplingStrategy.sample()` is `@final`. Custom strategies implement `_sample()` instead. | Anyone who wrote their own sampling strategy | Rename your `sample()` override to `_sample()`; see [building extensions](https://github.com/generative-computing/mellea/blob/v0.9.0/docs/docs/community/building-extensions.md) | [#1584](https://github.com/generative-computing/mellea/pull/1584) |
| Majority voting emits one lifecycle for the whole vote, not one per inner sample. | Hook or trace consumers of majority voting | Expect one `sampling_loop_start`/`end` pair per call | [#1584](https://github.com/generative-computing/mellea/pull/1584) |
| Async validators and SOFAI judges really run, so outputs that miss a requirement now fail. | SOFAI with `judge_backend`, async `validation_fn` users | Expect `success: False` where you saw passes before; those passes were never checked | [#1729](https://github.com/generative-computing/mellea/pull/1729) |
| A direct adapter-function call on an aLoRA that can't activate raises `AloraActivationError`. | Self-registered aLoRAs on `LocalHFBackend` | Catch it, or fix the prompt so the invocation sequence appears | [#1684](https://github.com/generative-computing/mellea/pull/1684) |
| Chat requests with no non-empty user content raise `ValueError`. | OpenAI, LiteLLM, and Ollama callers passing an empty action | Pass real content in the action | [#1632](https://github.com/generative-computing/mellea/pull/1632) |
| A non-dict `chat_template_kwargs` raises `TypeError` instead of being silently dropped. | Anyone passing `chat_template_kwargs` through `extra_body` | Pass a dict | [#1695](https://github.com/generative-computing/mellea/pull/1695) |

## Upgrading

```bash
pip install --upgrade mellea
```

To try LLMON, add the extra: `pip install --upgrade "mellea[hf,llmon]"`. Check
[behavior changes](#behavior-changes) first, especially if you write custom
sampling strategies or rely on SOFAI's judge. The
[full release notes](https://github.com/generative-computing/mellea/releases/tag/v0.9.0)
list all 29 PRs, including first contributions from three new people.

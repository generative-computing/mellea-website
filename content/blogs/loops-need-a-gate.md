---
title: "The Loop Needs a Gate"
date: "2026-06-11"
author: "Nigel Jones"
excerpt: "The industry just spent a fortnight agreeing you should write loops, not prompts. Everyone also agrees on the catch: a loop is only as good as the gate that can fail its work."
tags: ["loop-engineering", "harness-engineering", "verification", "IVR", "generative-programming", "requirements"]
---

Last week, Boris Cherny — Head of Claude Code at Anthropic — went viral for saying he
doesn't write prompts for Claude any more. He writes loops. Peter Steinberger had made much
the same point a few days earlier: "You shouldn't be prompting coding agents anymore. You
should be designing loops that prompt your agents." Addy Osmani followed up with a proper
essay, calling it [loop engineering](https://addyo.substack.com/p/loop-engineering).

Went round fast. Fair enough — the point is solid.

---

Strip it back and everyone is drawing the same thing. Simon Willison's definition of an
agent — close to where Anthropic landed too — is
["An LLM agent runs tools in a loop to achieve a goal."](https://simonwillison.net/2025/Sep/18/agents/)
LangChain put it almost identically:
["Agent = Model + Harness"](https://www.langchain.com/blog/the-anatomy-of-an-agent-harness).
The harness — the code around the model, the bit that isn't the model — is where the actual
engineering work happens.

Right. But here's what every honest take in this thread mentions and then sidesteps:

AlphaSignal said it plainest in
[Most Developers Do Not Need Agent Loops Yet](https://alphasignalai.substack.com/p/most-developers-do-not-need-agent):

> "The loop needs something that can fail the work without you in the room: a test suite,
> a type checker, a linter, a build. No automated check means you are back in the chair
> reading every diff, which is the exact job the loop was supposed to remove."

Anthropic's own
[Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
names the same shape: the evaluator-optimizer loop, where one model generates and another critiques. Worth noting: the word they use in their prompt chaining diagram
for the output check is "gate" — they named it in December 2024, eighteen months before the
current wave. A
[writeup of a recent UC Berkeley harness paper](https://bdtechtalks.substack.com/p/scaling-the-harness-the-next-major)
flags the "confident-but-unchecked" failure mode as the primary way multi-agent systems go
wrong. The dev.to counter-take,
[The Loop Is Not the Product](https://dev.to/dannwaneri/the-loop-is-not-the-product-466d),
is blunt: "the loop automates the typing, not the judgment."

Everyone lands in the same place. The loop isn't the hard part. **The gate is the hard part.**

---

By gate, we mean an automated check between the model's output and the rest of your system,
one that fails the work when outputs don't meet requirements. Not another model having a
look. Not a regex on the last line. Something that *actually* rejects bad output — same
rules, every time.

In practice, the gate barely exists in most of the architectures these essays describe. For
coding agents there's a test suite, if you're lucky. For everything else — structured
extraction, classification, summarization, decision support — the gate is usually the model
checking its own work, or nothing at all.

And the loop-engineering essays quietly assume the gate is expensive: one frontier model
critiquing another. But checking is narrower than generating. A deterministic requirement
costs nothing to run, and where you do need a model in the gate, a small one validating
against fixed rules is enough. You don't need to pay frontier prices twice.

A better loop topology won't fix that. A gate does.

---

In Mellea, the gate isn't an afterthought. You declare **requirements** — tone, length,
content rules, custom business logic — and Mellea validates every output against them before
anything else sees it. When validation fails, the feedback goes back to the model and it
tries again. That's the
**[Instruct-Validate-Repair (IVR) loop](/blogs/getting-started-with-mellea)**:
generate, check, repair, repeat — without you writing the retry scaffolding.

For harder guarantees, **constrained decoding** bakes the constraints into the generation
step itself. Valid output is enforced at the token level, not retried into existence
afterwards. The model can't produce output that violates your schema because the vocabulary
is constrained during sampling.

Both work with any backend — Ollama, vLLM, Hugging Face, OpenAI, Watsonx. Swap the model
and it's a one-line change. The gate stays put.

The gate works. Our [Qiskit case study](/blogs/qiskit-ivr-functional-validation) measured
it directly: adding structured validation feedback to the IVR loop lifted functional
correctness from 27.8% to 50.3%. And the gate doesn't need to be expensive: the
[SOFAI post](/blogs/cut-llm-costs-with-sofai) explains how small models handle validation
cheaply. **[Making Small Models Rock](/blogs/small-models-rock)** is the proof in
production — a real pipeline where 3B models do the validation work the harness routes to
them, exactly the gate this post argues for.

---

"Loop engineering" is a useful label for a real pattern. But every honest take on it has
the same footnote: the loop only works if something in the loop can *fail* the work. That
something is the gate. And in most pipelines today, it's missing.

So yes, write loops. Cherny, Steinberger, and Osmani are right. Just give them a proper gate.

---

**Get started**: `pip install mellea` · [docs.mellea.ai](https://docs.mellea.ai) · [github.com/generative-computing/mellea](https://github.com/generative-computing/mellea)

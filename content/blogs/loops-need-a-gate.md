---
title: "The Loop Needs a Gate"
date: "2026-06-10"
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
> a type checker, a linter, a build. No automated check means you're back in the chair
> reading every diff."

Anthropic's own
[Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
names the same shape: the evaluator-optimiser loop, where one model generates and another critiques. Worth noting: the word they use in their prompt chaining diagram
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
extraction, classification, summarisation, decision support — the gate is usually the model
checking its own work, or nothing at all.

A better loop topology won't fix that.

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

We started down this path when
[David Cox wrote about generative computing](/blogs/generative-computing) — treating the
LLM call as a typed, testable function in ordinary Python, not a prompt you fire off and
hope for the best. In
[Making Small Models Rock](/blogs/small-models-rock), Paul and Nathan showed what that looks
like in production: a harness that decomposes tasks, validates outputs, and routes each step
to the right model. The verified loop isn't new for us. It's the whole point.

---

"Loop engineering" is a useful label for a real pattern. But every honest take on it has
the same footnote: the loop only works if something in the loop can *fail* the work. That
something is the gate. And in most pipelines today, it's missing.

So yes, write loops. Cherny, Steinberger, and Osmani are right. Just give them a proper gate.

---

**Get started**: `pip install mellea` · [docs.mellea.ai](https://docs.mellea.ai) · [github.com/generative-computing/mellea](https://github.com/generative-computing/mellea)

The [getting-started guide](/blogs/getting-started-with-mellea) walks through a full
working example with IVR, and the
[small models post](/blogs/small-models-rock) shows requirements and validation applied to
a real production pipeline.

\#LoopEngineering \#HarnessEngineering \#AIAgents \#GenerativeAI \#ClaudeCode

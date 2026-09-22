---
title: "A Validator Doesn't Need to Write Prose"
date: "2026-09-23"
author: "Nigel Jones"
excerpt: "TypeSafe's Jev answers typed questions with probabilities instead of generating text. Mellea has been going at validation from the same direction, starting with the cheapest check that will do the job."
tags: ["validation", "requirements", "IVR", "granite", "switch", "loop-engineering"]
---

[Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), released last week by
[TypeSafe](https://typesafe.ai), doesn't write text. You pass in state and get back a typed answer
with a calibrated probability: Choice, Score, or Noul (a yes/no question answered with the
probability that it's yes). All the questions get answered in parallel, in one pass.

TypeSafe calls this a System One model, though you'll also see it called a typed decision model or
a structured classifier depending on who's writing. The name matters less than the shape, which is
unstructured input going in and typed probabilistic output coming back with nothing to parse. Jev
is TypeSafe's hosted implementation, but within days of the launch there were open-weight
alternatives ([decider-2b](https://huggingface.co/Mapika/decider-2b),
[Laya](https://huggingface.co/convaiinnovations/laya-typed-decisions), and
[Von](https://huggingface.co/wfzyx/von-1.0)) running the same primitives locally.

The [Hacker News thread](https://news.ycombinator.com/item?id=49717558) is worth reading, because
several people asked what genuinely separates this from encoder classifiers and constrained
decoding. Structurally there isn't much in it. A typed decision model is a classifier that returns
a calibrated probability where an encoder returns a label, and if your label set is fixed
(toxicity, fraud, intent) a trained encoder is cheaper and you should just use one.

Classifiers and calibration have been around for decades, so the primitive isn't the new part.
What's changed is that classification now ships on the same surface as everything else in the
stack, so you get open weights, natural-language input, new requirements evaluated at runtime, and
no task-specific head to retrain. You also get the decision itself, and you don't have to parse it
back out of a sentence. That's roughly where these sit between an encoder and a generative judge,
and either way the core premise holds: a validator doesn't need to be able to write.

---

That matters because of what validation costs. Run your checks through a general-purpose model and
you pay generation prices to extract one bit of information, then you write a parser for the
sentence it came back in. A typed decision model solves the cost side of that, but cost is only
part of why people skip validation in the first place, and skipping it is how you end up with a
human checking every output before it can be trusted. [The argument here in
June](/blogs/loops-need-a-gate) was that the gate, rather than the loop around it, is the hard part
of agent design.

Look at what those checks actually ask. Is this total a positive number? Do the line items sum to
the subtotal? Is this answer grounded in the document that was retrieved? Does the output meet the
requirement that was set?

Every one of those is a yes/no, a label from a small set, or a number. None of them needs a
paragraph.

---

Mellea's unit of validation is a `Requirement`, wrapped in a repair loop. The design starts from
the cheapest check that will do the job and only moves up when it won't.

**No model.** `validation_fn` takes plain Python, so receipt arithmetic, a schema assertion or a
test suite all work: if the property is computable, a function checks it exactly and for free. It's
the cheapest gate available and the most reliable one. Moving to functional tests inside the IVR
loop took functional correctness from 27.8% to 50.3% on the Qiskit Human Eval benchmark, with the
same model and the same loop but a [different gate](/blogs/qiskit-ivr-functional-validation).

**Constrained decoding.** Pass `format=` a Pydantic model and tokens that would break the schema
are never available to pick, so the constraint is enforced at the token level, so there is nothing
to catch afterwards. `@generative` gives you the same guarantee from a typed function signature,
with no extra call and no second model.

**A general model as judge.** For semantic checks that aren't computable, `requirements=` takes
plain-English constraints, and a failing check feeds its reason into the next attempt.

**A specialized validator.** [Granite Switch](/blogs/granite-switch) is a single Granite 4.1
checkpoint with validation adapter functions built into the weights, covering answerability,
hallucination detection, requirement checking and citations. A validator becomes a function call
against the backend you already have, and because it uses activated LoRA the base-model KV cache
survives each call, so chaining validators doesn't recompute the context three times. On IFEval the
embedded adapter [reaches 84% balanced
accuracy](https://research.ibm.com/blog/granite-libraries-project-switch) where prompting base
Granite 4.1 3B gets 51%.

**Routing between them.** [SOFAI](/blogs/cut-llm-costs-with-sofai) tries a fast model first, uses
the validator's failure reason to repair, and escalates only when feedback stops helping.

The first three work against any backend Mellea supports (Ollama, vLLM, Hugging Face, OpenAI,
Watsonx). The adapter functions are the exception: that catalogue is Granite, it needs vLLM on a
GPU, and the model IDs are still marked `-preview`. Without it you drop to a general model as judge
on that one rung, which costs you some accuracy there and nothing else.

---

Both approaches cover similar ground (scoring, guardrail checks, requirement validation) but they
wire it differently.

A typed decision model is a good fit when you need many checks in one call and want to branch on
the result directly in code without parsing anything. The calibrated confidence is the useful part:
if the probabilities are honest you can set a threshold and predict, across many decisions, roughly
how often you'll be wrong. That's what makes it work for routing and automated triage, because you
get error rates you can reason about, which a bare pass or fail won't give you.

What it gives up is narrower than "it can't say why". A classifier can identify which categories
failed, and the output struct can be as rich as you design it, down to which span failed. What it
can't produce is a novel explanation. Something like "paragraph 3 contradicts the claim that Acme
acquired Beta in 2021" has to compose tokens from the specific input, and selecting from a fixed
vocabulary won't get you there. Selecting is cheaper though, and at the gate it's enough. That puts
a typed decision model in the same category as Switch's adapter functions, a specialized check that
doesn't generate, and the difference is really one of delivery: a hosted typed API you call against
anything, versus adapters inside a checkpoint you already serve, sharing its KV cache. Save the
generative model for the point where the answer has to be written rather than chosen.

---

Mellea covers the same checks (`requirement_check` and `policy_guardrails` are both there as
adapter functions) but the design is oriented around repair rather than routing. The one-call
advantage narrows here too, because activated LoRA means chaining adapters reuses the base model's
KV cache, so three checks don't pay for the context three times. A failing check returns a reason,
and that reason is what the next attempt acts on. The score drives a pass/fail decision that feeds
the loop, and calibrated confidence across many predictions isn't what the repair loop needs.
Mellea doesn't produce it either. Where the job is triaging at volume against a threshold you have
to defend, a typed decision model wins outright, and putting a repair loop around it adds nothing.
That's the design difference: one approach optimizes for knowing how often you'll be wrong at
scale, the other for fixing what's wrong right now. They're solving two different optimization
problems: routing minimizes what you spend under uncertainty, while repair maximizes correctness on
the task in front of you.

Where Mellea goes further than a bare score is what happens after a check fails. The IVR loop feeds
the reason into the next generation attempt, so the model sees what it got wrong and tries again.
SOFAI extends that: if repair stalls, it escalates to a more capable model automatically. The
trigger is whether the output is actually improving, so it won't just reach for the next model in a
fallback list. The loop is also observable in a way a hosted score isn't, since hooks fire at every
lifecycle point so you can see which requirements failed, when repairs triggered, and whether the
feedback actually helped.

---

| Situation                | Better fit           |
| ------------------------ | -------------------- |
| High-volume routing      | Typed decision model |
| Automated triage         | Typed decision model |
| Guardrail checks         | Either               |
| Repair loops             | Mellea               |
| Self-correction          | Mellea               |
| Multi-attempt generation | Mellea               |

The two approaches aren't mutually exclusive, and the reason is structural: a typed decision model
is a validator, and Mellea is what you put validators inside. A typed decision model suits the
*gate* question (is this output good enough to proceed, with a confidence score you can reason
about?) while Mellea suits the *generation loop*, which is keep trying until it is. The slot for it
already exists, because `validation_fn` takes plain Python, so a call to a typed decision model
drops in exactly where the receipt arithmetic went: it scores the output and Mellea drives the
retry. The failure categories go into the repair prompt alongside the requirement text, which gives
you more signal than a bare pass/fail but less than a written explanation. Wire it that way when a
threshold you can reason about at the gate is worth more than the sharpest possible repair prompt,
and keep a generative validator when the loop has to converge in as few attempts as it can.

---

- [The Requirements System](https://docs.mellea.ai/concepts/requirements-system): how
  `Requirement`, `ValidationResult`, and `simple_validate` fit together
- [Instruct-Validate-Repair](https://docs.mellea.ai/concepts/instruct-validate-repair): the loop,
  sampling strategies, and how repair prompts are built
- [Adapter functions](https://docs.mellea.ai/advanced/intrinsics): the full validation surface
  against one checkpoint
- [Write Custom Verifiers](https://docs.mellea.ai/how-to/write-custom-verifiers): validation
  functions beyond string checks
- [Granite Switch in Mellea](/blogs/granite-switch): setup, and running answerability and
  hallucination detection end to end

---
title: "A Validator Doesn't Need to Write Prose"
date: "2026-09-22"
author: "Nigel Jones"
excerpt: "TypeSafe's Jev answers typed questions with probabilities instead of generating text. Mellea has been going at validation from the same direction — the cheapest check that will do the job."
tags: ["validation", "requirements", "IVR", "granite", "switch", "loop-engineering"]
---

[Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), released last week by
[TypeSafe](https://typesafe.ai), doesn't write text. State in, typed answer with a calibrated
probability out — Choice, Score, or Noul (a yes/no question answered with the probability it's
yes). All questions answered in parallel, in one pass.

That's the pattern TypeSafe calls a System One model — or a typed decision model, or a structured
classifier, depending on who you ask. The name matters less than the shape: unstructured input,
typed probabilistic output, nothing to parse. Jev is TypeSafe's hosted implementation; within days
of the launch there were open-weight alternatives —
[decider-2b](https://huggingface.co/Mapika/decider-2b),
[Laya](https://huggingface.co/convaiinnovations/laya-typed-decisions), and
[Von](https://huggingface.co/wfzyx/von-1.0) — running the same primitives locally.

The [Hacker News thread](https://news.ycombinator.com/item?id=49717558) is worth reading — several
people asked what genuinely separates this from encoder classifiers and constrained decoding.
Structurally, not much: a typed decision model is a classifier that returns a calibrated
probability instead of a label. And if your label set is fixed — toxicity, fraud, intent — a
trained encoder is cheaper, and you should just use one.

What's new isn't the primitive. Classifiers and calibration are decades old. It's that
classification now ships on the same surface as everything else in the stack: open weights,
natural-language input, new requirements at runtime, no task-specific head to retrain. The decision
is the product rather than something you parse back out of prose. That's what puts these between an
encoder and a generative judge — and the core premise holds either way: a validator doesn't need to
be able to write.

---

That matters because of what validation costs. Run checks through a general-purpose model and you
pay generation prices to extract one bit of information, then write a parser for the sentence it
came back in. A typed decision model solves the cost side of that — but cost is only part of why
people skip validation. Skipping it is how you end up with a human checking every output before it
can be trusted. [The argument here in June](/blogs/loops-need-a-gate) was that this, not the
loop around it, is the hard part of agent design.

Look at what those checks actually ask. Is this total a positive number? Do the line items sum to
the subtotal? Is this answer grounded in the document that was retrieved? Does the output meet the
requirement that was set?

Every one of those is a yes/no, a label from a small set, or a number. None of them needs a
paragraph.

---

Mellea's unit of validation is a `Requirement`, wrapped in a repair loop. The design starts from
the cheapest check that will do the job and only moves up when it won't.

**No model.** `validation_fn` takes plain Python. Receipt arithmetic, a schema assertion, a test
suite — if the property is computable, a function checks it exactly, for free. This is the
cheapest gate available and the most reliable. Moving to functional tests inside the IVR loop took
functional correctness from 27.8% to 50.3% on the Qiskit Human Eval benchmark, same model, same
loop, [different gate](/blogs/qiskit-ivr-functional-validation).

**Constrained decoding.** Pass `format=` a Pydantic model and tokens that would break the schema
are never available to pick — the constraint is enforced at the token level, not caught after the
fact. `@generative`
gives the same guarantee from a typed function signature. No extra call, no second model.

**A general model as judge.** For semantic checks that aren't computable, `requirements=` takes
plain-English constraints and a failing check feeds its reason into the next attempt.

**A specialized validator.** [Granite Switch](/blogs/granite-switch) is a single Granite 4.1
checkpoint with validation adapter functions built into the weights — answerability, hallucination
detection, requirement checking, citations. A validator becomes a function call against the backend
you already have,
and because it uses activated LoRA the base-model KV cache survives each call. Chaining
validators doesn't recompute the context three times. On IFEval, the embedded adapter
[reaches 84% balanced accuracy](https://research.ibm.com/blog/granite-libraries-project-switch)
where prompting base Granite 4.1 3B gets 51%.

**Routing between them.** [SOFAI](/blogs/cut-llm-costs-with-sofai) tries a fast model first, uses
the validator's failure reason to repair, and escalates only when feedback stops helping.

The first three rungs work against any backend Mellea supports — Ollama, vLLM, Hugging Face,
OpenAI, Watsonx. The adapter functions are the exception: that catalog is Granite, needs vLLM on
a GPU, and the model IDs are still marked `-preview`. Without it you drop to a general model as
judge on that rung — which costs some accuracy there, and nothing else.

---

Both approaches cover similar ground — scoring, guardrail checks, requirement validation — and
they wire it differently.

A typed decision model is a good fit when you need many checks in one call and want to branch on
the result directly in code with no parsing. At its core it's a classifier — it returns a
probability, not prose. The calibrated confidence is the useful part: if the probabilities are
honest, you can set a threshold and predict, across many decisions, roughly how often you'll be
wrong. That's what makes it work for routing and automated triage — you can reason about error
rates, not just pass/fail.

What it gives up is narrower than "it can't say why". A classifier can identify which categories
failed, and the output struct can be as rich as you design it — down to which span failed. What it
can't produce is a novel explanation: "paragraph 3 contradicts the claim that Acme acquired Beta in
2021" means composing tokens from the specific input, not selecting from a fixed vocabulary.
Selecting is cheaper, and at the gate it's enough. That puts a typed decision model in the same
category as Switch's adapter functions — a specialized check that doesn't generate. The difference
is delivery: a hosted typed API you call against anything, versus adapters inside a checkpoint you
already serve, sharing its KV cache. Save the generative model for the point where the answer has
to be written rather than chosen.

---

Mellea covers the same checks — `requirement_check` and `policy_guardrails` are both there as
adapter functions — but the design is oriented around repair rather than routing. The one-call
advantage narrows here too: activated LoRA means chaining adapters reuses the base model's KV
cache, so three checks don't pay for the context three times. A failing check returns a reason, and
that reason is what the next attempt acts on. The score drives a pass/fail decision that feeds the
loop; calibrated confidence across many predictions isn't what the repair loop needs — and Mellea
doesn't produce it. Where the job is triaging at volume against a threshold you have to defend, a
typed decision model wins outright, and putting a repair loop around it adds nothing. That's the
design difference: one approach optimizes for knowing how often you'll be wrong at scale, the other
for fixing what's wrong right now. They're different optimization problems, not rival answers to
one: routing minimizes what you spend under uncertainty, repair maximizes correctness on the task
in front of you.

Where Mellea goes further than a bare score is what happens after a check fails. The IVR loop feeds
the reason into the next generation attempt, and the model sees what it got wrong and tries again.
SOFAI extends that: if repair stalls, it escalates to a more capable model automatically — based on
whether the output is actually improving, not on which model is configured next in a fallback list.
And where a hosted score tells you nothing about the loop it sits in, this one is observable: hooks
fire at every lifecycle point so you can see which requirements failed, when repairs triggered, and
whether the feedback actually helped.

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
is a validator, and Mellea is what you put validators inside. A typed decision model is well-suited
to the *gate* question — is this output good enough to proceed, with a confidence score you can
reason about? Mellea is well-suited to the *generation loop* — keep trying until it is. And the
slot for it already exists: `validation_fn` takes plain Python, so a call to a typed decision model
drops in exactly where the receipt arithmetic went. It scores the output, Mellea drives the retry.
The failure categories go into the repair prompt alongside the requirement text — more signal than
a bare pass/fail, less than a written explanation. Wire it that way when a threshold you can reason
about at the gate is worth more than the sharpest possible repair prompt; keep a generative
validator when the loop has to converge in as few attempts as it can.

---

- [The Requirements System](https://docs.mellea.ai/concepts/requirements-system) — how
  `Requirement`, `ValidationResult`, and `simple_validate` fit together
- [Instruct-Validate-Repair](https://docs.mellea.ai/concepts/instruct-validate-repair) — the
  loop, sampling strategies, and how repair prompts are built
- [Adapter functions](https://docs.mellea.ai/advanced/intrinsics) — the full validation surface
  against one checkpoint
- [Write Custom Verifiers](https://docs.mellea.ai/how-to/write-custom-verifiers) — validation
  functions beyond string checks
- [Granite Switch in Mellea](/blogs/granite-switch) — setup, and running answerability and
  hallucination detection end to end

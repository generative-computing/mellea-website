---
title: "A Validator Doesn't Need to Write Prose"
date: "2026-09-21"
author: "Nigel Jones"
excerpt: "TypeSafe's Jev answers typed questions with probabilities instead of generating text. Mellea has been going at validation from the same direction — the cheapest check that will do the job."
tags: ["validation", "requirements", "IVR", "granite", "switch", "loop-engineering"]
---

[Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), released last week by
[TypeSafe](https://typesafe.ai), doesn't write text. State in, typed answer with a calibrated
probability out — Choice, Score, or Noul (yes/no). All questions answered in parallel, in one
pass. No text generated.

That's the pattern TypeSafe call a System One model — or a typed decision model, or a structured
classifier, depending on who you ask. The name matters less than the shape: unstructured input,
typed probabilistic output, nothing to parse. Jev is TypeSafe's hosted implementation; within days
of the launch there were open-weight alternatives —
[decider-2b](https://huggingface.co/Mapika/decider-2b),
[Laya](https://huggingface.co/convaiinnovations/laya-typed-decisions),
[Von](https://huggingface.co/wfzyx/von-1.0) — running the same primitives locally.

The [Hacker News thread](https://news.ycombinator.com/item?id=49717558) is worth reading —
several people asked what genuinely separates this from encoder classifiers and constrained
decoding. The core premise holds regardless: a validator doesn't need to be able to write.

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
are never available to pick — malformed output isn't caught, it's unrepresentable. `@generative`
gives the same guarantee from a typed function signature. No extra call, no second model.

**A general model as judge.** For semantic checks that aren't computable, `requirements=` takes
plain-English constraints and a failing check feeds its reason into the next attempt.

**A specialised validator.** [Granite Switch](/blogs/granite-switch) is a single Granite 4.1
checkpoint with validation adapter functions built into the weights — answerability, hallucination
detection, requirement checking, citations. A validator becomes a function call against the backend
you already have,
and because it uses activated LoRA the base-model KV cache survives each call. Chaining
validators doesn't recompute the context three times. On IFEval, the embedded adapter
[reaches 84% balanced accuracy](https://research.ibm.com/blog/granite-libraries-project-switch)
where prompting base Granite 4.1 3B gets 51%.

**Routing between them.** [SOFAI](/blogs/cut-llm-costs-with-sofai) tries a fast model first, uses
the validator's failure reason to repair, and escalates only when feedback stops helping.

---

Both approaches cover similar ground — scoring, guardrail checks, requirement validation — and
they wire it differently.

A typed decision model is a good fit when you need many checks in one call and want to branch on
the result directly in code with no parsing. The calibrated confidence is the useful part: if the
probabilities are honest, you can set a threshold and predict, across many decisions, roughly how
often you'll be wrong. That's what makes it work for routing and automated triage — you can
reason about error rates, not just pass/fail.

---

Mellea covers the same checks — `requirement_check` and `policy_guardrails` are both there as
adapter functions — but the design is oriented around repair rather than routing. A failing check
returns a reason, and that reason is what the next attempt acts on. The score drives a pass/fail
decision that feeds the loop; calibrated confidence across many predictions isn't what the repair
loop needs. That's the design difference: one approach optimises for knowing how often you'll be
wrong at scale, the other for fixing what's wrong right now.

Where Mellea goes further is when the check needs to do more than report a result. A typed
decision model has no generation capability — it scores, it doesn't fix. Mellea's IVR loop takes
the failure reason and feeds it back into the next generation attempt; the model sees what it got
wrong and tries again. SOFAI extends that: if repair stalls, it escalates to a more capable model
automatically, driven by output quality rather than availability. Before any model is involved, a
`validation_fn` can run any computable check — arithmetic, schema, a test suite — for free. And
the whole loop is observable: hooks fire at every lifecycle point so you can see which
requirements failed, when repairs triggered, and whether the feedback actually helped.

---

The two approaches aren't mutually exclusive. A typed decision model is well-suited to the
*gate* question — is this output good enough to proceed, with a confidence score you can reason
about? Mellea is well-suited to the *generation loop* — keep trying until it is. You could wire
a typed decision model as the validator inside a Mellea `Requirement`: it scores the output, the
reason feeds the repair prompt, and Mellea drives the retry. Each does what it's built for.

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

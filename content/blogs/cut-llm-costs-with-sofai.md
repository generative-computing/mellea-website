---
title: "Cut LLM Costs Without Sacrificing Quality: The SOFAI Pattern in Mellea"
date: "2026-05-06"
author: "Nigel Jones"
excerpt: "Route most requests to a small model and escalate only hard cases to a larger one — Mellea's SOFAISamplingStrategy makes the dual-model pattern a one-line strategy swap."
tags: ["sofai", "sampling", "cost", "ollama"]
---

Most LLM applications eventually hit the same wall: you started by routing everything through your best model, and now the bill is uncomfortably large. The expensive model handles the hard problems beautifully — but it's doing the same job on trivial tasks that a model ten times cheaper could handle.

The instinct is to swap to a cheaper model entirely. The problem: smaller models fail on the hard cases, and you have to choose between overspending on quality or degrading the experience.

**SOFAI** (Slow and Fast AI) sidesteps that trade-off. Instead of picking one model for everything, it uses a fast model as a first-pass solver and escalates to a stronger model only when the fast one genuinely can't solve the problem. The result: most requests pay small-model prices, hard requests get the quality they need.

Mellea's `SOFAISamplingStrategy` implements this pattern as a first-class sampling strategy, building on the same [Instruct-Validate-Repair](https://docs.mellea.ai/concepts/instruct-validate-repair) loop that powers the rest of the library. If you haven't used Mellea before, [Getting Started with Mellea](/blogs/getting-started-with-mellea) is a good five-minute primer.

> **Best fit:** tasks with verifiable outputs — structured data extraction, schema validation, constraint satisfaction, code generation. If you can't check correctness programmatically, skip to [Trade-offs](#trade-offs-and-when-not-to-use-it).

## Why "Slow and Fast"?

The name comes from Daniel Kahneman's dual-process thinking model (System 1: fast and automatic; System 2: slow and deliberate), formalized by IBM Research into an [AI architecture for LLMs](https://www.nature.com/articles/s44387-025-00027-5). The core idea: decide *when* to invoke the expensive solver — and most of the time, the fast one is good enough.

Mellea's implementation brings that into a Python library you can use today, with any Ollama-compatible, OpenAI-compatible, or WatsonX backend.

## How the Loop Works

SOFAI operates in two phases:

**Phase 1 — S1 loop (fast model):**

1. Generate a candidate with the fast model.
2. Validate against your requirements.
3. If it passes — return immediately.
4. If it fails — extract the specific reason from the `ValidationResult` and repair.
5. Repeat up to `loop_budget` times.
6. If no improvement is detected between consecutive attempts, exit early.

**Phase 2 — S2 escalation (slow model):**

- Triggered when S1 exhausts its budget.
- Makes a single attempt with the more capable model.
- How S2 receives context depends on `s2_solver_mode` (see below).

The repair loop is only as useful as the feedback it receives. SOFAI passes `ValidationResult.reason` directly into the repair prompt — a vague "validation failed" gives the model nothing to act on, but a specific "Nodes C and D are adjacent but both have color 'Red'" tells it exactly what to fix.

```text
Request
   ↓
S1 (fast) ←──── repair w/ failure reason ────┐
   ↓                                           │
Validate                                       │
   ├── pass ─────────────────────────────→ Result
   └── fail ──────────────────────────────────┘
         (loop exhausted or no improvement)
              ↓
         S2 (slow) → Validate → Result
```

## A Working Example: Graph Coloring

Graph coloring is a canonical constraint satisfaction problem — useful for demos because small models fail on it often enough to exercise the escalation path, while larger models solve it more reliably. Assign colors to nodes so that no two adjacent nodes share a color.

Here's the full setup:

```python
import json
import mellea
from mellea.backends.ollama import OllamaModelBackend
from mellea.stdlib.context import ChatContext
from mellea.stdlib.requirements import ValidationResult, req
from mellea.stdlib.sampling import SOFAISamplingStrategy

# Define a 5-node cycle graph (odd cycle — needs 3 colors, tricky for small models)
graph = {"A": ["B", "E"], "B": ["A", "C"], "C": ["B", "D"], "D": ["C", "E"], "E": ["D", "A"]}
colors = ["Red", "Blue", "Green"]
```

The validator is where the quality of feedback matters most. Return specific, actionable reasons:

```python
def check_graph_coloring(ctx) -> ValidationResult:
    output = ctx.last_output()
    if output is None:
        return ValidationResult(False, reason="No output. Expected JSON like {\"A\": \"Red\", ...}")

    # Parse the coloring (handle markdown code fences from the model)
    raw = str(output.value).strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1].lstrip("json").strip()
    try:
        coloring = json.loads(raw)
    except json.JSONDecodeError:
        return ValidationResult(False, reason="Output is not valid JSON.")

    errors = []

    # Check all nodes are present
    missing = set(graph) - set(coloring)
    if missing:
        errors.append(f"Missing nodes: {', '.join(sorted(missing))}")

    # Check colors are valid
    bad_colors = [c for c in coloring.values() if c not in colors]
    if bad_colors:
        errors.append(f"Invalid colors {set(bad_colors)}. Use: {', '.join(colors)}")

    # Check adjacency constraints
    if not errors:
        for node, neighbours in graph.items():
            for nb in neighbours:
                if nb in coloring and coloring.get(node) == coloring[nb]:
                    errors.append(f"Adjacent nodes {node}–{nb} both have color '{coloring[node]}'")

    if errors:
        return ValidationResult(False, reason=" | ".join(errors))
    return ValidationResult(True, reason="Valid coloring.")
```

Now wire it together with SOFAI. The session backend is set to the fast model — SOFAI swaps to the slow model internally when it escalates:

```python
# Any Ollama-compatible model pair works (e.g. llama3.1:8b + llama3.1:70b, mistral:7b + mixtral:8x7b)
s1_backend = OllamaModelBackend(model_id="granite4:micro")   # Fast, cheap
s2_backend = OllamaModelBackend(model_id="granite4:latest")  # Slow, stronger

sofai = SOFAISamplingStrategy(
    s1_solver_backend=s1_backend,
    s2_solver_backend=s2_backend,
    s2_solver_mode="best_attempt",  # S2 sees S1's best result so far
    loop_budget=3,
)

m = mellea.MelleaSession(backend=s1_backend, ctx=ChatContext())

result = m.instruct(
    "Color the nodes of the graph (A, B, C, D, E) using at most 3 colors "
    "(Red, Blue, Green). Adjacent nodes must have different colors. "
    "Adjacencies: A-B, B-C, C-D, D-E, E-A. "
    'Return JSON: {"A": "Red", "B": "Green", ...}',
    requirements=[req("Valid graph coloring.", validation_fn=check_graph_coloring)],
    strategy=sofai,
    return_sampling_results=True,
    model_options={"temperature": 0.1, "seed": 42},
)

print(f"Success: {result.success}")
print(f"Attempts: {len(result.sample_generations)}")
```

Example output when S1 fails twice and S2 resolves it:

```text
Attempt 1 — S1 (granite4:micro): FAIL
  Reason: Adjacent nodes A–B both have color 'Red'
Attempt 2 — S1 (granite4:micro): FAIL
  Reason: Adjacent nodes C–D both have color 'Blue'
Attempt 3 — S2 (granite4:latest): PASS
  {"A": "Red", "B": "Blue", "C": "Red", "D": "Blue", "E": "Green"}

Success: True
Attempts: 3
```

When S1 succeeds on the first or second attempt, you pay nothing for the large model at all.

Want to know if SOFAI saves money for your workload? Run the same validator against your own prompts and compare S1 pass rates — the higher the S1 pass rate, the more you save.

## Controlling S2 Context with `s2_solver_mode`

How much context S2 receives when it takes over affects both quality and token cost. Three modes are available:

| Mode | What S2 sees | When to use |
| ---- | ----------- | ----------- |
| `"fresh_start"` | Original prompt only, no S1 history | S1 history is noisy or contradictory |
| `"continue_chat"` | Full S1 conversation history | Problem benefits from seeing prior attempts |
| `"best_attempt"` | S1's best output + failure summary | Best trade-off for most constraint problems |

`"best_attempt"` is the recommended default for constraint satisfaction tasks: S2 starts from a near-solution and fixes specific violations rather than reasoning from scratch.

## Feedback Strategies

For LLM-based validation instead of a custom function, pass a `judge_backend` and set `feedback_strategy` to `"simple"`, `"first_error"`, or `"all_errors"`. Use `"all_errors"` when multiple constraints can fail simultaneously; `"first_error"` reduces prompt length at the cost of more repair iterations.

## Comparing the Before / After

**Before — single model for everything:**

```python
# All requests go to the large model.
m = mellea.MelleaSession(backend=OllamaModelBackend("granite4:latest"))
result = m.instruct(prompt, requirements=requirements)
```

Cost: large-model tokens for every request, including the easy ones.

**After — SOFAI dual-model escalation:**

```python
sofai = SOFAISamplingStrategy(
    s1_solver_backend=OllamaModelBackend("granite4:micro"),
    s2_solver_backend=OllamaModelBackend("granite4:latest"),
    loop_budget=3,
)
m = mellea.MelleaSession(backend=OllamaModelBackend("granite4:micro"), ctx=ChatContext())
result = m.instruct(prompt, requirements=requirements, strategy=sofai)
```

Cost: small-model tokens for requests S1 can handle; large-model tokens only on escalation.

How much this saves depends entirely on your task distribution and the cost gap between your two models. If S1 handles the majority of requests without escalation, the saving can be substantial — small models are often an order of magnitude cheaper per token than large ones. If your tasks are uniformly hard, you pay for S1 attempts before every S2 call with no saving at all. Profile your own workload before assuming a win.

SOFAI can also pair with backend failover: run S1 against a local model and S2 against a cloud model, so you get both cost savings *and* a fallback if the local backend is unavailable. See [LLM Provider Failover with Mellea](/blogs/blog-llm-provider-failover-mellea) for the layered failover pattern.

## Trade-offs and When Not to Use It

SOFAI adds overhead you should account for:

- **Minimum latency increases.** Every request pays at least one full S1 generation + validation. If your workload is uniformly hard, you're adding S1 calls before every S2 call with no savings.
- **Requires a good validator.** The repair loop is only as useful as your `ValidationResult.reason` feedback. Generic validators that return "failed" give the model nothing to act on.
- **`ChatContext` required.** `SOFAISamplingStrategy` requires a `ChatContext` session because the repair loop is multi-turn. Sessions using a stateless context will error.
- **S2 is still a fallback, not guaranteed.** SOFAI makes one S2 attempt. If S2 also fails, the best result from S1 is returned. Design your pipeline accordingly.

SOFAI is a good fit for tasks with verifiable outputs — code generation, structured data extraction, constraint satisfaction, JSON schema validation. It is less useful for open-ended generation tasks where correctness can't be checked programmatically.

## Get Started

The full runnable example is in the repository:

```bash
pip install mellea
# with Ollama running and granite4:micro + granite4:latest pulled:
python docs/examples/sofai/sofai_graph_coloring.py
```

- **Source:** [`mellea/stdlib/sampling/sofai.py`](https://github.com/generative-computing/mellea/blob/main/mellea/stdlib/sampling/sofai.py)
- **Example:** [`docs/examples/sofai/sofai_graph_coloring.py`](https://github.com/generative-computing/mellea/blob/main/docs/examples/sofai/sofai_graph_coloring.py)
- **Docs:** [Inference-Time Scaling guide](https://docs.mellea.ai/advanced/inference-time-scaling)

If you're hitting API costs that don't match the complexity of your tasks, SOFAI is worth trying. Most pipelines with verifiable outputs can drop it in as a strategy swap with no other changes.

---

*Questions or feedback? Open an issue or start a discussion on the [mellea GitHub repository](https://github.com/generative-computing/mellea).*

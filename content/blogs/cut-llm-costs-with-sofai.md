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

Graph coloring is a canonical constraint satisfaction problem — useful for demos because small models fail on it often enough to exercise the escalation path, while larger models solve it more reliably. The task: assign a color to each node so that no two adjacent nodes share the same color.

We'll use a 5-node cycle (pentagon) — each node connected to its two neighbours. An odd cycle requires at least 3 colors, which makes it a genuine challenge for smaller models:

```text
    A
   / \
  E   B
  |   |
  D - C
```

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

We chose these two models deliberately to keep the memory footprint small: `granite4:350m-h` is 340 million parameters (~366 MB on disk) and `granite4:1b-h` is 1.5 billion parameters (~1.6 GB on disk). Both use Q8_0 quantization. Ollama loads one model at a time, so you need roughly 4 GB RAM — the total weight of both models is under 2 GB, leaving comfortable headroom for the OS and KV cache. Any machine that can run Ollama can run this example.

Worth noting: the Granite 4 hybrid architecture is surprisingly capable at structured output tasks for its size — the 1.5B model solves graph coloring reliably, and even the 340M model gets it right more often than you might expect. We picked the 340M as S1 specifically to exercise the escalation path; in a real pipeline the natural breakpoint between tiers will depend on your task.

Now wire it together with SOFAI. The session backend is set to the fast model — SOFAI swaps to the slow model internally when it escalates:

```python
# Any Ollama-compatible model pair works (e.g. llama3.2:1b + llama3.2:3b)
s1_backend = OllamaModelBackend(model_id="granite4:350m-h")  # 340M params — fast, cheap
s2_backend = OllamaModelBackend(model_id="granite4:1b-h")    # 1.5B params — slower, more capable

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

That's the complete application code. Mellea owns the retry and escalation cycle — your code just calls `instruct()`:

```text
Your code           │  Mellea handles
────────────────────┼───────────────────────────────────────
m.instruct(         │  ┌─ S1: generate candidate
  prompt,           │  ├─ validate → extract failure reason
  strategy=sofai,   │  ├─ repair with specific feedback
)                   │  ├─ retry up to loop_budget times
                    │  ├─ detect no-improvement → escalate
                    │  ├─ S2: generate with S1 context
result              │  └─ validate → return result
```

The repair prompt construction, failure detection, S2 context handoff, and loop termination all happen inside `SOFAISamplingStrategy`. You get the result (or the best attempt if everything fails) with no custom orchestration logic.

Example output when S1 fails twice and S2 resolves it:

```text
Attempt 1 — S1 (granite4:350m-h): FAIL
  Reason: Invalid colors {'Yellow'}. Use: Red, Blue, Green
Attempt 2 — S1 (granite4:350m-h): FAIL
  Reason: Invalid colors {'Yellow'}. Use: Red, Blue, Green
Attempt 3 — S2 (granite4:1b-h): PASS
  {"A": "Red", "B": "Blue", "C": "Red", "D": "Blue", "E": "Green"}

Success: True
Attempts: 3
```

The 350M model keeps reaching for "Yellow" despite being explicitly told to use only Red, Blue, and Green. The 1.5B model receives that failure reason alongside the bad attempt, understands the constraint, and solves it cleanly.

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
# All requests go to the larger model.
m = mellea.MelleaSession(backend=OllamaModelBackend("granite4:1b-h"))
result = m.instruct(prompt, requirements=requirements)
```

Cost: 1.5B-model tokens for every request, including the easy ones.

**After — SOFAI dual-model escalation:**

```python
sofai = SOFAISamplingStrategy(
    s1_solver_backend=OllamaModelBackend("granite4:350m-h"),
    s2_solver_backend=OllamaModelBackend("granite4:1b-h"),
    loop_budget=3,
)
m = mellea.MelleaSession(backend=OllamaModelBackend("granite4:350m-h"), ctx=ChatContext())
result = m.instruct(prompt, requirements=requirements, strategy=sofai)
```

Cost: small-model tokens for requests S1 can handle; large-model tokens only on escalation.

How much this saves depends entirely on your task distribution and the cost gap between your two models. If S1 handles the majority of requests without escalation, the saving can be substantial — small models are often an order of magnitude cheaper per token than large ones. If your tasks are uniformly hard, you pay for S1 attempts before every S2 call with no saving at all. Profile your own workload before assuming a win.

**Going further — cloud model as S2:** the example above uses two local models, but in production the most common SOFAI setup is a local or cheap model as S1 and a cloud API as S2. Mellea backends are interchangeable, so swapping S2 to OpenAI is one line:

```python
from mellea.backends.openai import OpenAIBackend  # reads OPENAI_API_KEY from env

sofai = SOFAISamplingStrategy(
    s1_solver_backend=OllamaModelBackend("granite4:350m-h"),  # local, free
    s2_solver_backend=OpenAIBackend(model_id="gpt-4o-mini"),  # cloud, only on escalation
    loop_budget=3,
)
```

The same pattern works with `BedrockBackend`, or any OpenAI-compatible endpoint via `base_url`. SOFAI can also pair with backend failover: run S1 locally and S2 in the cloud, so you get cost savings *and* a fallback if the local backend is unavailable. See [LLM Provider Failover with Mellea](/blogs/blog-llm-provider-failover-mellea) for the layered failover pattern.

**A harder example — Sudoku:** graph coloring is a good introduction, but small models (1.5B and below) can often stumble through it. For a task that genuinely requires reasoning capacity, Sudoku is a sharper test: a 1.5B local model consistently fails to fill the grid correctly, while a 27B cloud model solves it on the first attempt — making the cost case concrete. The validator, SOFAI setup, and `instruct()` call follow exactly the same pattern as above; only the prompt and validator function change.

## Trade-offs and When Not to Use It

SOFAI adds overhead you should account for:

- **Minimum latency increases.** Every request pays at least one full S1 generation + validation. If your workload is uniformly hard, you're adding S1 calls before every S2 call with no savings.
- **Requires a good validator.** The repair loop is only as useful as your `ValidationResult.reason` feedback. Generic validators that return "failed" give the model nothing to act on.
- **`ChatContext` required.** `SOFAISamplingStrategy` requires a `ChatContext` session because the repair loop is multi-turn. Sessions using a stateless context will error.
- **S2 is still a fallback, not guaranteed.** SOFAI makes one S2 attempt. If S2 also fails, the best result from S1 is returned. Design your pipeline accordingly.

SOFAI is a good fit for tasks with verifiable outputs — code generation, structured data extraction, constraint satisfaction, JSON schema validation. It is less useful for open-ended generation tasks where correctness can't be checked programmatically.

## Get Started

You'll need [uv](https://docs.astral.sh/uv/getting-started/installation/) (fast Python package manager) and [Ollama](https://ollama.ai) running locally with two models pulled.

```bash
# Install uv — https://docs.astral.sh/uv/getting-started/installation/
curl -LsSf https://astral.sh/uv/install.sh | sh

# Pull the two models into Ollama (~2 GB total, ~4 GB RAM required)
ollama pull granite4:350m-h  # 340M model — S1 fast solver
ollama pull granite4:1b-h    # 1.5B model — S2 slow solver

# Create a project and install Mellea
uv init sofai-example
cd sofai-example
uv add mellea
```

Save this complete script as `sofai_graph_coloring.py` and run it:

```python
import json
import mellea
from mellea.backends.ollama import OllamaModelBackend
from mellea.stdlib.context import ChatContext
from mellea.stdlib.requirements import ValidationResult, req
from mellea.stdlib.sampling import SOFAISamplingStrategy

graph = {"A": ["B", "E"], "B": ["A", "C"], "C": ["B", "D"], "D": ["C", "E"], "E": ["D", "A"]}
colors = ["Red", "Blue", "Green"]

def check_graph_coloring(ctx) -> ValidationResult:
    output = ctx.last_output()
    if output is None:
        return ValidationResult(False, reason="No output. Expected JSON like {\"A\": \"Red\", ...}")
    raw = str(output.value).strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1].lstrip("json").strip()
    try:
        coloring = json.loads(raw)
    except json.JSONDecodeError:
        return ValidationResult(False, reason="Output is not valid JSON.")
    errors = []
    missing = set(graph) - set(coloring)
    if missing:
        errors.append(f"Missing nodes: {', '.join(sorted(missing))}")
    bad_colors = [c for c in coloring.values() if c not in colors]
    if bad_colors:
        errors.append(f"Invalid colors {set(bad_colors)}. Use: {', '.join(colors)}")
    if not errors:
        for node, neighbours in graph.items():
            for nb in neighbours:
                if nb in coloring and coloring.get(node) == coloring[nb]:
                    errors.append(f"Adjacent nodes {node}–{nb} both have color '{coloring[node]}'")
    if errors:
        return ValidationResult(False, reason=" | ".join(errors))
    return ValidationResult(True, reason="Valid coloring.")

s1_backend = OllamaModelBackend(model_id="granite4:350m-h")
s2_backend = OllamaModelBackend(model_id="granite4:1b-h")

sofai = SOFAISamplingStrategy(
    s1_solver_backend=s1_backend,
    s2_solver_backend=s2_backend,
    s2_solver_mode="best_attempt",
    loop_budget=3,
)

m = mellea.MelleaSession(backend=s1_backend, ctx=ChatContext())
result = m.instruct(
    "Color the nodes of the graph (A, B, C, D, E) using only the colors "
    "Red, Blue, or Green. Adjacent nodes must have different colors. "
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

```bash
uv run python sofai_graph_coloring.py
```

- **Source:** [`mellea/stdlib/sampling/sofai.py`](https://github.com/generative-computing/mellea/blob/main/mellea/stdlib/sampling/sofai.py)
- **Docs:** [Inference-Time Scaling guide](https://docs.mellea.ai/advanced/inference-time-scaling)

If you're hitting API costs that don't match the complexity of your tasks, SOFAI is worth trying. Most pipelines with verifiable outputs can drop it in as a strategy swap with no other changes.

---

*Questions or feedback? Open an issue or start a discussion on the [mellea GitHub repository](https://github.com/generative-computing/mellea).*

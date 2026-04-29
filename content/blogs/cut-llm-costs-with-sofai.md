---
title: "Cut LLM Costs Without Sacrificing Quality: The SOFAI Pattern in Mellea"
date: "2026-05-06"
author: "Nigel Jones"
excerpt: "Route most requests to a small model and escalate only hard cases to a larger one — Mellea's SOFAISamplingStrategy makes the dual-model pattern a one-line strategy swap."
tags: ["sofai", "sampling", "cost", "ollama"]
---

**Your LLM bill is too high.** Not because you're doing anything wrong — because you're routing *every* request through your best model, including the easy ones a model ten times cheaper could handle.

Swap to a cheaper model entirely? Then the hard cases degrade. You're stuck choosing between quality and cost.

**There's a better way: use both.**

**SOFAI** (Slow and Fast AI) tries the fast, cheap model first. If it gets the answer right — great, you pay nothing for the expensive one. Only when it genuinely fails does **Mellea** escalate to the stronger model. *Most requests pay small-model prices. Hard requests get the quality they need.*

Mellea makes this a one-line change to your existing pipeline. Let's see it in action.

## See It in Action

**Prerequisites** — you'll need two tools installed:

- **[uv](https://docs.astral.sh/uv/getting-started/installation/)** — Python package manager. Install with one command: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **[Ollama](https://ollama.ai)** — runs local LLMs. Download and install from [ollama.ai](https://ollama.ai), then start it.

If you haven't used Mellea before at all, the [Getting Started with Mellea](/blogs/getting-started-with-mellea) post covers the basics end-to-end.

**Step 1 — Pull the two models** (~2 GB total download, ~4 GB RAM required to run):

```bash
ollama pull granite4:350m-h  # 340M params, Q8_0 — S1 fast solver
ollama pull granite4:1b-h    # 1.5B params, Q8_0 — S2 slow solver
```

**Step 2 — Create a project and install Mellea:**

```bash
uv init sofai-example
cd sofai-example
uv add mellea
```

**Step 3 — The example problem:** the script solves a **graph coloring** task: assign a color to each node of a pentagon so that no two adjacent nodes share the same color. It's a constraint satisfaction problem with an objectively right answer — perfect for SOFAI because we can validate correctness programmatically. The 340M model tries first; the 1.5B model steps in only if it fails.

```text
    A
   / \
  E   B
  |   |
  D - C
```

**Step 4 — Save this as `sofai_graph_coloring.py`:**

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

**Step 5 — Run it:**

```bash
uv run python sofai_graph_coloring.py
```

You should see output like this — the small model fails twice, the larger one steps in and solves it:

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

Read on for a breakdown of what happened.

## What Just Happened

You just saw SOFAI in action. The 340M model tried and failed twice — then the 1.5B model stepped in and solved it. Here's what each part of the script does.

**The validator** is the most important piece. It checks three things — are all nodes present, are only valid colors used, are adjacent nodes different colors — and returns a *specific reason string* for every failure:

```python
errors.append(f"Adjacent nodes {node}–{nb} both have color '{coloring[node]}'")
# ...
return ValidationResult(False, reason=" | ".join(errors))
```

That reason string is what SOFAI feeds directly into the repair prompt. The model knows exactly what it got wrong, not just that it failed.

**The SOFAI strategy** wraps your two backends with escalation logic. The two Granite 4 hybrid models (Q8_0, ~2 GB total, ~4 GB RAM) give a genuine capability split at minimal footprint:

```python
sofai = SOFAISamplingStrategy(
    s1_solver_backend=OllamaModelBackend("granite4:350m-h"),  # 340M — fast, cheap
    s2_solver_backend=OllamaModelBackend("granite4:1b-h"),    # 1.5B — slower, more capable
    s2_solver_mode="best_attempt",
    loop_budget=3,
)
```

Then pass it as `strategy=sofai` to `m.instruct()`. That's the *only* change to your application code.

> **You don't write the retry loop.** The repair prompt construction, failure detection, S2 context handoff, and loop termination all happen inside `SOFAISamplingStrategy`. Your code calls `instruct()` and gets back a result — no custom orchestration needed.

The 340M model keeps reaching for "Yellow" despite being told to use only Red, Blue, and Green — a typical failure mode for very small models on structured tasks. The 1.5B model receives that specific failure reason alongside the bad attempt, understands the constraint, and solves it cleanly. When S1 *does* succeed on the first or second attempt, you pay nothing for the larger model at all.

Want to know if SOFAI saves money for your workload? Run the same validator against your own prompts and compare S1 pass rates — the higher the S1 pass rate, the more you save.

## How SOFAI Works

SOFAI operates in two phases driven by the same [Instruct-Validate-Repair](https://docs.mellea.ai/concepts/instruct-validate-repair) loop that powers the rest of Mellea.

**Phase 1 — S1 loop (fast model):**

1. Generate a candidate with the fast model.
2. Validate against your requirements.
3. If it passes — return immediately. You never touch the expensive model.
4. If it fails — extract the specific reason from the `ValidationResult` and repair.
5. Repeat up to `loop_budget` times.
6. If no improvement is detected between consecutive attempts, exit early and escalate.

**Phase 2 — S2 escalation (slow model):**

- Triggered when S1 exhausts its budget without a passing result.
- Makes a single attempt with the more capable model.
- How much context S2 receives is controlled by `s2_solver_mode` (more on this below).

```text
Request
   ↓
S1 (fast) ←──── repair w/ failure reason ────┐
   ↓                                         │
Validate                                     │
   ├── pass ─────────────────────────────→ Result
   └── fail ─────────────────────────────────┘
         (loop exhausted or no improvement)
              ↓
         S2 (slow) → Validate → Result
```

SOFAI passes `ValidationResult.reason` *directly* into the repair prompt — the "Adjacent nodes C and D both have color 'Red'" failure reason you saw above is exactly what the model receives. **Specific failure reasons are what make the repair loop useful** — a vague "validation failed" gives the model nothing to act on.

The name comes from Daniel Kahneman's dual-process thinking model (System 1: fast and automatic; System 2: slow and deliberate), formalized by IBM Research into an [AI architecture for LLMs](https://www.nature.com/articles/s44387-025-00027-5). The core idea: decide *when* to invoke the expensive solver — and most of the time, the fast one is good enough.

## Configuring SOFAI

### How much context does S2 get? (`s2_solver_mode`)

When S2 takes over, how much context it receives affects both quality and token cost:

| Mode | What S2 sees | When to use |
| ---- | ----------- | ----------- |
| `"fresh_start"` | Original prompt only, no S1 history | S1 history is noisy or contradictory |
| `"continue_chat"` | Full S1 conversation history | Problem benefits from seeing prior attempts |
| `"best_attempt"` | S1's best output + failure summary | Best trade-off for most constraint problems |

`"best_attempt"` is the recommended default: S2 starts from a near-solution and fixes specific violations rather than reasoning from scratch.

### LLM-based validation (`feedback_strategy`)

If you'd rather use an LLM to judge correctness instead of a custom function, pass a `judge_backend` and set `feedback_strategy` to `"simple"`, `"first_error"`, or `"all_errors"`. Use `"all_errors"` when multiple constraints can fail simultaneously; `"first_error"` reduces prompt length at the cost of more repair iterations.

## The Cost Story

The entire change to your application is one parameter:

```python
# Before: every request pays large-model tokens
result = m.instruct(prompt, requirements=requirements)

# After: S1 handles what it can; S2 only invoked on escalation
result = m.instruct(prompt, requirements=requirements, strategy=sofai)
```

How much this saves depends entirely on your task distribution and the cost gap between your models. If S1 handles the majority of requests, the saving can be substantial — small models are often an order of magnitude cheaper per token than large ones. If your tasks are uniformly hard, you pay for S1 attempts before every S2 call with no saving at all. **Profile your own workload before assuming a win.**

## Going Further

### Cloud model as S2

The most common production SOFAI setup is a local or cheap model as S1 and a cloud API as S2. Mellea backends are interchangeable — swapping S2 to OpenAI is one line:

```python
from mellea.backends.openai import OpenAIBackend  # reads OPENAI_API_KEY from env

sofai = SOFAISamplingStrategy(
    s1_solver_backend=OllamaModelBackend("granite4:350m-h"),  # local, free
    s2_solver_backend=OpenAIBackend(model_id="gpt-4o-mini"),  # cloud, only on escalation
    loop_budget=3,
)
```

The same pattern works with `BedrockBackend`, or any OpenAI-compatible endpoint via `base_url`. You also get a natural failover story: if the local backend is unavailable, S2 is already there. See [LLM Provider Failover with Mellea](/blogs/blog-llm-provider-failover-mellea) for the layered failover pattern.

### A harder problem: Sudoku

Graph coloring demonstrates the pattern, but the Granite 4 hybrid architecture is genuinely capable at structured tasks — the 1.5B model handles it reliably. For a task that *truly* separates the tiers, Sudoku is sharper. A 1.5B local model consistently violates given cells (it fills the grid but overwrites fixed values); a 27B cloud model solves it first attempt.

The SOFAI setup is identical — only the puzzle and validator change:

```python
# Medium Sudoku (0 = empty)
PUZZLE = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    # ...
]

def check_sudoku(ctx) -> ValidationResult:
    # Parse JSON grid, then check:
    # 1. Given cells are preserved
    # 2. All rows contain 1–9 exactly once
    # 3. All columns contain 1–9 exactly once
    # 4. All 3×3 boxes contain 1–9 exactly once
    ...
    return ValidationResult(False, reason="Row 3 missing [4, 8] | Col 5 missing [2]")
```

```python
sofai = SOFAISamplingStrategy(
    s1_solver_backend=OllamaModelBackend("granite4:1b-h"),          # local, free
    s2_solver_backend=OpenAIBackend(                                 # cloud, on escalation
        model_id="google/gemma-3-27b-it:free",
        base_url="https://openrouter.ai/api/v1",
        api_key=os.environ["OPENROUTER_API_KEY"],
    ),
    s2_solver_mode="best_attempt",
    loop_budget=3,
)
```

When S1 fails, SOFAI sends its best attempt *plus the specific cell violations* to the cloud model — which corrects them and returns a valid solution. The cloud API is only called once, only when needed.

The [complete Sudoku cloud example](https://github.com/generative-computing/mellea/blob/main/docs/examples/sofai/sofai_graph_coloring.py) follows this structure. The only new dependency is an `OPENROUTER_API_KEY` (free tier available at [openrouter.ai](https://openrouter.ai)).

## Trade-offs and When Not to Use It

> **Best fit:** SOFAI works well on tasks with verifiable outputs — structured data extraction, schema validation, constraint satisfaction, code generation. If you can't check correctness programmatically, the repair loop has nothing to work with.

SOFAI adds overhead worth being honest about:

- **Latency increases.** Every request pays at least one full S1 generation + validation. If your workload is uniformly hard, you're adding S1 cost before every S2 call with no benefit.
- **Validator quality matters.** The repair loop is only as good as your `ValidationResult.reason`. Generic "failed" messages give the model nothing to act on.
- **`ChatContext` is required.** `SOFAISamplingStrategy` needs `ChatContext` because the repair loop is multi-turn. Stateless contexts will error.
- **S2 is one attempt, not guaranteed.** If S2 also fails, the best S1 result is returned. Design your pipeline accordingly.

SOFAI shines on tasks with verifiable outputs — code generation, structured data extraction, constraint satisfaction, JSON schema validation. It's less useful for open-ended generation where correctness can't be checked programmatically.

- **Source:** [`mellea/stdlib/sampling/sofai.py`](https://github.com/generative-computing/mellea/blob/main/mellea/stdlib/sampling/sofai.py)
- **Docs:** [Inference-Time Scaling guide](https://docs.mellea.ai/advanced/inference-time-scaling)

If you're hitting API costs that don't match the complexity of your tasks, SOFAI is worth trying. Most pipelines with verifiable outputs can drop it in as a strategy swap — write a validator, pass `strategy=sofai`, and let Mellea handle the rest.

---

*Questions or feedback? Open an issue or start a discussion on the [Mellea GitHub repository](https://github.com/generative-computing/mellea).*

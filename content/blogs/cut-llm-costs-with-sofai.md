---
title: "Cut LLM Costs Without Sacrificing Quality: The SOFAI Pattern in Mellea"
date: "2026-05-01"
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

**Step 1 — Pull the models for the graph coloring example** (~2 GB download):

```bash
ollama pull granite4:350m-h  # 340M params, Q8_0 — graph coloring S1
ollama pull granite4:3b      # 3B params — graph coloring S2
```

> The Sudoku example further down uses a different S1 model and a cloud S2 — you'll pull that one only if you choose to run it.

**Step 2 — Create a project and install Mellea:**

```bash
uv init sofai-example
cd sofai-example
uv add mellea
```

**Step 3 — The example problem:** the script solves a **graph coloring** task: assign one of three colors (Red, Blue, Green) to each node of a 9-node ring graph so that no two neighboring nodes share the same color. It's a constraint satisfaction problem with an objectively correct answer — perfect for SOFAI because we can validate correctness programmatically. The 340M model tries first; the 3B model steps in only if it fails.

```text
A – B – C – D – E – F – G – H – I – A  (ring: each node adjacent to its two neighbors)
```

**Step 4 — Save this as `sofai_graph_coloring.py`:**

> The script is about 30 lines of problem-specific constraint logic (the validator), plus about 10 lines of Mellea. The validator is yours to write for any task — the Mellea parts are always the same. `req()` wraps your validator into a `Requirement` that Mellea can evaluate and feed into the repair loop.

```python
import json
import mellea
from mellea.backends.ollama import OllamaModelBackend
from mellea.stdlib.context import ChatContext
from mellea.stdlib.requirements import ValidationResult, req
from mellea.stdlib.sampling import SOFAISamplingStrategy

# ── Problem definition ─────────────────────────────────────────────────────
graph = {
    "A": ["B", "I"], "B": ["A", "C"], "C": ["B", "D"], "D": ["C", "E"],
    "E": ["D", "F"], "F": ["E", "G"], "G": ["F", "H"], "H": ["G", "I"],
    "I": ["H", "A"],
}
colors = ["Red", "Blue", "Green"]

# ── Validator: your domain logic goes here ────────────────────────────────
# Return a specific reason string — Mellea feeds it into the repair prompt.
def check_graph_coloring(ctx) -> ValidationResult:
    output = ctx.last_output()
    if output is None:
        return ValidationResult(False, reason="No output. Expected JSON like {\"A\": \"Red\", ...}")
    raw = str(output.value).strip()
    if "```" in raw:
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

# ── Mellea: this part is always the same ──────────────────────────────────
s1_backend = OllamaModelBackend(model_id="granite4:350m-h")
s2_backend = OllamaModelBackend(model_id="granite4:3b")

sofai = SOFAISamplingStrategy(
    s1_solver_backend=s1_backend,
    s2_solver_backend=s2_backend,
    s2_solver_mode="fresh_start",  # default — S2 sees only the original prompt, not S1's attempts
    loop_budget=3,
)

m = mellea.MelleaSession(backend=s1_backend, ctx=ChatContext())
result = m.instruct(
    "Color the nodes of this graph (A, B, C, D, E, F, G, H, I) using only the colors "
    "Red, Blue, or Green. Adjacent nodes must have different colors. "
    "Adjacencies: A-B, B-C, C-D, D-E, E-F, F-G, G-H, H-I, I-A. "
    'Return JSON: {"A": "Red", "B": "Green", ...}',
    requirements=[req("Valid graph coloring.", validation_fn=check_graph_coloring)],
    strategy=sofai,
    return_sampling_results=True,  # expose per-attempt results (generations + validations)
    model_options={"temperature": 0.1, "seed": 42},
)

total = len(result.sample_generations)
# Infer whether S2 was used: if the second-to-last attempt failed, the last was S2.
# Assumes S1 never succeeds on a late attempt — valid when S1 reliably fails before escalating.
s2_escalated = (
    total > 1 and not all(bool(v) for _, v in result.sample_validations[total - 2])
    if total > 1 else False
)
for i, validations in enumerate(result.sample_validations, 1):
    is_s2 = s2_escalated and i == total
    label = f"S2 ({s2_backend.model_id})" if is_s2 else f"S1 ({s1_backend.model_id})"
    passed = all(bool(v) for _, v in validations)
    print(f"Attempt {i} — {label}: {'PASS' if passed else 'FAIL'}")
    if not passed:
        for _, v in validations:
            if not bool(v):
                print(f"  Reason: {v.reason}")
    else:
        raw = str(result.sample_generations[i - 1].value).strip()
        if "```" in raw:  # some models wrap JSON in a code fence even when not asked
            raw = raw.split("```")[1].lstrip("json").strip()
        print(f"  {json.dumps(json.loads(raw))}")

print(f"\nSuccess: {result.success}")
print(f"Attempts: {total}")
```

**Step 5 — Run it:**

```bash
uv run python sofai_graph_coloring.py
```

You should see output like this — the small model fails twice, the larger one steps in and solves it:

```text
Attempt 1 — S1 (granite4:350m-h): FAIL
  Reason: Output is not valid JSON.
Attempt 2 — S1 (granite4:350m-h): FAIL
  Reason: Output is not valid JSON.
Attempt 3 — S2 (granite4:3b): PASS
  {"A": "Red", "B": "Blue", "C": "Red", "D": "Green", "E": "Blue", "F": "Red", "G": "Green", "H": "Blue", "I": "Green"}

Success: True
Attempts: 3
```

Read on for a breakdown of what happened.

## What Just Happened

You just saw SOFAI in action. The 340M model tried and failed twice — then the 3B model stepped in and solved it. Here's what each part of the script does.

**The validator** is the most important piece. It checks three things — are all nodes present, are only valid colors used, are adjacent nodes different colors — and returns a *specific reason string* for every failure:

```python
errors.append(f"Adjacent nodes {node}–{nb} both have color '{coloring[node]}'")
# ...
return ValidationResult(False, reason=" | ".join(errors))
```

That reason string is what SOFAI feeds directly into the repair prompt. The model knows exactly what it got wrong, not just that it failed.

**The SOFAI strategy** wraps your two backends with escalation logic. The two Granite 4 models give a genuine capability split at modest footprint:

```python
sofai = SOFAISamplingStrategy(
    s1_solver_backend=OllamaModelBackend("granite4:350m-h"),  # 340M — fast, cheap
    s2_solver_backend=OllamaModelBackend("granite4:3b"),      # 3B — slower, more capable
    s2_solver_mode="fresh_start",  # default — S2 sees only the original prompt
    loop_budget=3,
)
```

Then pass it as `strategy=sofai` to `m.instruct()`. That's the *only* change to your application code.

> **You don't write the retry loop.** Without Mellea, you'd need roughly 40–50 lines of orchestration: call S1, parse the validation result, format the failure reason into a repair prompt, retry up to N times, detect stalled progress, hand off to S2 with the right context, and return the best result. `SOFAISamplingStrategy` handles all of that. Your code calls `instruct()` with `strategy=sofai` and gets back a result.

The 340M model outputs prose with markdown code fences instead of the required JSON — a typical failure mode for very small models on structured output tasks. The 3B model solves it cleanly from the same original prompt. When S1 *does* succeed on the first or second attempt, you pay nothing for the larger model at all.

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
- How much context S2 receives is controlled by `s2_solver_mode` (covered in [Is SOFAI Right for Your Workload?](#is-sofai-right-for-your-workload)).

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

SOFAI passes `ValidationResult.reason` *directly* into the repair prompt — the "Output is not valid JSON." or "Adjacent nodes A–I both have color 'Red'" failure reason you saw above is exactly what the model receives on each retry. **Specific failure reasons are what make the repair loop useful** — a vague "validation failed" gives the model nothing to act on.

The name comes from Daniel Kahneman's dual-process thinking model (System 1: fast and automatic; System 2: slow and deliberate), formalized by IBM Research into an [AI architecture for LLMs](https://www.nature.com/articles/s44387-025-00027-5). The core idea: decide *when* to invoke the expensive solver — and most of the time, the fast one is good enough.

## The Cost Story

The entire change to your application is one parameter:

```python
# Before: every request pays large-model tokens
result = m.instruct(prompt, requirements=requirements)

# After: S1 handles what it can; S2 only invoked on escalation
result = m.instruct(prompt, requirements=requirements, strategy=sofai)
```

How much this saves depends entirely on your task distribution and the cost gap between your models. If S1 handles the majority of requests, the saving can be substantial — small models are often an order of magnitude cheaper per token than large ones. If your tasks are uniformly hard, you pay for S1 attempts before every S2 call with no saving at all.

## Going Further: A Harder Problem

Graph coloring is a good first example, but it only exercises two local models — it doesn't demonstrate the full capability gap that SOFAI is designed for in production. For that, **Sudoku** is the real test.

The rules: fill every empty cell in a 9×9 grid so that each row, each column, and each 3×3 box contains every digit from 1 to 9 exactly once. The given cells are fixed — you must work around them:

```text
5 3 . | . 7 . | . . .
6 . . | 1 9 5 | . . .
. 9 8 | . . . | . 6 .
------+-------+------
8 . . | . 6 . | . . 3
4 . . | 8 . 3 | . . 1
7 . . | . 2 . | . . 6
------+-------+------
. 6 . | . . . | 2 8 .
. . . | 4 1 9 | . . 5
. . . | . 8 . | . 7 9
```

A correct solution fills every `.` with a digit such that no row, column, or box repeats. There are 27 constraints to satisfy simultaneously — and you must not overwrite a given cell.

Sudoku requires holding all 27 constraints in mind while reasoning about each empty cell. Small models fail not because they ignore instructions but because the reasoning load genuinely exceeds their capacity. A 70B cloud model (llama-3.3-70b-versatile via Groq) solves it on the first attempt.

This is exactly the SOFAI value proposition made concrete: **run cheaply on a local model for the easy cases, pay for cloud inference only when you genuinely need the reasoning power.**

The code follows the same pattern as graph coloring. Only the puzzle, validator, and one tuning parameter change — `loop_budget` drops from 3 to 1 because the 1.5B model has no useful chance of self-repair on this task, so there's no point letting it try twice before escalating.

**This is an optional, more involved example** — you can skip it if you'd prefer to stay local-only. It requires a cloud API key. You can use any OpenAI-compatible provider by changing `base_url` and `model_id`; see [Backends and Configuration](https://docs.mellea.ai/how-to/backends-and-configuration) for the full list (OpenAI, Bedrock, LiteLLM, and more).

The example below uses a free [Groq](https://console.groq.com) account — 1,000 requests/day, no credit card required. Pull the Sudoku S1 model and set your key:

```bash
ollama pull granite4:1b-h    # 1.5B params, Q8_0 — Sudoku S1
export GROQ_API_KEY=<your-key>
```

**Save this as `sofai_sudoku_cloud.py` and run it:**

> Again, the bulk of the code is problem-specific constraint checking — the Mellea parts at the bottom are the same ~10 lines as before.

```python
import json
import os
import mellea
from mellea.backends.ollama import OllamaModelBackend
from mellea.backends.openai import OpenAIBackend
from mellea.stdlib.context import ChatContext
from mellea.stdlib.requirements import ValidationResult, req
from mellea.stdlib.sampling import SOFAISamplingStrategy

# ── Problem definition ─────────────────────────────────────────────────────
PUZZLE = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9],
]

def puzzle_str() -> str:
    lines = []
    for i, row in enumerate(PUZZLE):
        if i in (3, 6):
            lines.append("------+-------+------")
        parts = [str(x) if x else "." for x in row]
        lines.append(" ".join(parts[:3]) + " | " + " ".join(parts[3:6]) + " | " + " ".join(parts[6:]))
    return "\n".join(lines)

# ── Validator: your domain logic goes here ────────────────────────────────
def check_sudoku(ctx) -> ValidationResult:
    output = ctx.last_output()
    if output is None:
        return ValidationResult(False, reason="No output.")
    raw = str(output.value).strip()
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip()
    try:
        grid = json.loads(raw)
    except json.JSONDecodeError:
        return ValidationResult(False, reason="Output is not valid JSON.")
    if not isinstance(grid, list) or len(grid) != 9:
        return ValidationResult(False, reason=f"Expected 9 rows, got {len(grid) if isinstance(grid, list) else type(grid).__name__}.")
    for i, row in enumerate(grid):
        if not isinstance(row, list) or len(row) != 9:
            return ValidationResult(False, reason=f"Row {i+1} must have 9 integers.")
        for j, val in enumerate(row):
            if not isinstance(val, int) or not (1 <= val <= 9):
                return ValidationResult(False, reason=f"Cell [{i+1}][{j+1}] = {val!r} — must be 1–9.")
    errors = []
    for r in range(9):                              # given cells must be preserved
        for c in range(9):
            if PUZZLE[r][c] != 0 and grid[r][c] != PUZZLE[r][c]:
                errors.append(f"Cell [{r+1}][{c+1}] must be {PUZZLE[r][c]}, got {grid[r][c]}")
    if errors:
        return ValidationResult(False, reason=" | ".join(errors[:3]))
    for r in range(9):                              # rows
        if sorted(grid[r]) != list(range(1, 10)):
            errors.append(f"Row {r+1} missing {sorted(set(range(1,10)) - set(grid[r]))}")
    for c in range(9):                              # columns
        col = [grid[r][c] for r in range(9)]
        if sorted(col) != list(range(1, 10)):
            errors.append(f"Column {c+1} missing {sorted(set(range(1,10)) - set(col))}")
    for br in range(3):                             # 3×3 boxes
        for bc in range(3):
            box = [grid[br*3+r][bc*3+c] for r in range(3) for c in range(3)]
            if sorted(box) != list(range(1, 10)):
                errors.append(f"Box [{br+1}][{bc+1}] missing {sorted(set(range(1,10)) - set(box))}")
    if errors:
        return ValidationResult(False, reason=" | ".join(errors[:3]))
    return ValidationResult(True, reason="Valid Sudoku solution.")

s1_backend = OllamaModelBackend(model_id="granite4:1b-h")
s2_backend = OpenAIBackend(
    model_id="llama-3.3-70b-versatile",
    base_url="https://api.groq.com/openai/v1",
    api_key=os.environ["GROQ_API_KEY"],
)

sofai = SOFAISamplingStrategy(
    s1_solver_backend=s1_backend,
    s2_solver_backend=s2_backend,
    s2_solver_mode="fresh_start",  # default — S2 sees only the original prompt
    loop_budget=1,
)

m = mellea.MelleaSession(backend=s1_backend, ctx=ChatContext())
result = m.instruct(
    f"Solve this Sudoku. Fill every empty cell (shown as '.') so each row, "
    f"column, and 3×3 box contains 1–9 exactly once.\n\n{puzzle_str()}\n\n"
    "Return ONLY a JSON 2D array with exactly 9 rows and 9 integers per row:\n"
    "[[r1c1,r1c2,r1c3,r1c4,r1c5,r1c6,r1c7,r1c8,r1c9],[r2c1,...,r2c9],...,[r9c1,...,r9c9]]",
    requirements=[req("Valid Sudoku solution.", validation_fn=check_sudoku)],
    strategy=sofai,
    return_sampling_results=True,  # expose per-attempt results (generations + validations)
    model_options={"temperature": 0.5, "seed": 0},
)

total = len(result.sample_generations)
# Infer whether S2 was used: if the second-to-last attempt failed, the last was S2.
# Assumes S1 never succeeds on a late attempt — valid when S1 reliably fails before escalating.
s2_escalated = (
    total > 1 and not all(bool(v) for _, v in result.sample_validations[total - 2])
    if total > 1 else False
)
for i, validations in enumerate(result.sample_validations, 1):
    is_s2 = s2_escalated and i == total
    label = f"S2 ({s2_backend.model_id})" if is_s2 else f"S1 ({s1_backend.model_id})"
    passed = all(bool(v) for _, v in validations)
    print(f"Attempt {i} — {label}: {'PASS' if passed else 'FAIL'}")
    if not passed:
        for _, v in validations:
            if not bool(v):
                print(f"  Reason: {v.reason}")

print(f"\nSuccess: {result.success}")
print(f"Attempts: {total}")
```

```bash
uv run python sofai_sudoku_cloud.py
```

You should see S1 fail with specific cell violations, then S2 step in and solve it:

```text
Attempt 1 — S1 (granite4:1b-h): FAIL
  Reason: Cell [3][8] must be 6, got 7 | Cell [6][9] must be 6, got 5
Attempt 2 — S2 (llama-3.3-70b-versatile): PASS

Success: True
Attempts: 2
```

The 1.5B model *almost* solves the puzzle — it produces a plausible-looking grid but overwrites a couple of fixed cells with wrong values. The cloud model solves it cleanly on its single attempt (`fresh_start` — S2 sees only the original prompt). The cloud API was called once.

Mellea backends are interchangeable — the same setup works with any OpenAI-compatible endpoint via `base_url`, or `BedrockBackend` for AWS. See also [LLM Provider Failover with Mellea](/blogs/blog-llm-provider-failover-mellea) for combining SOFAI with backend failover.

## Is SOFAI Right for Your Workload?

SOFAI works best on tasks with **verifiable outputs** — structured data extraction, schema validation, constraint satisfaction, code generation. If you can't check correctness programmatically, the repair loop has nothing to drive it.

A few things worth knowing before you ship it:

- **Measure your S1 pass rate first.** Run SOFAI against a sample of your real workload and see how often S1 succeeds without escalation. That number, combined with the cost gap between your models, tells you exactly what you save. If S1 rarely passes, the S1 overhead before every S2 call may outweigh the benefit.
- **Validator quality drives repair quality.** The repair loop is only as good as your `ValidationResult.reason` string. Specific failure messages ("Row 3 missing [4, 8]") give the model something to fix; generic ones ("failed") don't.
- **Every request pays S1 latency.** If your workload is uniformly hard, you're adding generation time before every S2 call with no saving.
- **`ChatContext` is required.** The repair loop is multi-turn — stateless contexts will error.
- **S2 is one attempt.** If S2 also fails, S2's result is returned as-is. Design your pipeline accordingly.

To tune further: `s2_solver_mode` controls how much context S2 receives — `"fresh_start"` (default, original prompt only), `"continue_chat"` (full S1 conversation history), or `"best_attempt"` (S1's best output + failure summary; best for constraint problems). `judge_backend` and `feedback_strategy` let you use an LLM as the validator instead of a custom function. Full details in the docs below.

- **Source:** [`mellea/stdlib/sampling/sofai.py`](https://github.com/generative-computing/mellea/blob/main/mellea/stdlib/sampling/sofai.py)
- **API reference:** [`SOFAISamplingStrategy`](https://docs.mellea.ai/api/mellea/stdlib/sampling/sofai) · [`ValidationResult`](https://docs.mellea.ai/api/mellea/core/requirement) · [Requirements system](https://docs.mellea.ai/concepts/requirements-system)
- **Guides:** [Inference-Time Scaling](https://docs.mellea.ai/advanced/inference-time-scaling) · [Instruct-Validate-Repair](https://docs.mellea.ai/concepts/instruct-validate-repair)

If you're hitting API costs that don't match the complexity of your tasks, SOFAI is worth trying. Write a validator, pass `strategy=sofai`, and let Mellea handle the rest.

---

*Questions or feedback? Open an issue or start a discussion on the [Mellea GitHub repository](https://github.com/generative-computing/mellea).*

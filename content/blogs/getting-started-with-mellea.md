---
title: "Getting Started with Mellea in Five Minutes"
date: "2026-04-27"
author: "Angelo Danducci II"
excerpt: "Install uv, pull a local model with Ollama, and build your first Mellea pipeline from scratch — no API key, no cloud, fully private."
tags: ["getting-started", "ollama", "tutorial"]
---

This guide walks you through everything you need to build your first Mellea pipeline: installing uv, pulling a local model with Ollama, and writing a small but complete generative program.  While models can vary drastically in size, this example should be able to run on machines with 8GB of RAM and approximately 6GB of additional disk space for model and installed requirements.

---

## Step 1: Install uv

[uv](https://docs.astral.sh/uv/) is a fast Python package and project manager — it handles Python installs, virtual environments, and dependencies in one tool. Check the [uv install instructions](https://docs.astral.sh/uv/getting-started/installation/) - at the time of writing you can use:

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Verify uv is set up:

```bash
uv --version
```

uv will manage Python for you — no separate Python install needed.

---

## Step 2: Create a project

```bash
uv init mellea-demo
cd mellea-demo
```

This creates a minimal project with a `.python-version` file and a managed virtual environment.

uv picks up Python 3.11+ automatically.

---

## Step 3: Install Mellea

```bash
uv add mellea
```

uv creates the virtual environment, resolves dependencies, and installs everything in one step.

Verify it installed cleanly:

```bash
uv pip show mellea
```

---

## Step 4: Install Ollama

Mellea is model-agnostic, but we'll use [Ollama](https://ollama.com) to run a model locally — no API key, no cloud, fully private. See [installation instructions for Ollama](https://ollama.com/download).  At the time of writing these are:

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows (PowerShell)
irm https://ollama.com/install.ps1 | iex
```

Verify installation with:

```bash
ollama --version
```

Ollama runs a local HTTP server that Mellea talks to. No extra configuration needed — the defaults work out of the box.

---

## Step 5: Pull a model

We'll use Granite 4 Micro — a compact, instruction-tuned model that pairs well with Mellea's IVR loop:

```bash
ollama pull granite4:micro
```

This downloads a couple of gigabytes, so give it a moment. Once it finishes, confirm it's available:

```bash
ollama list
```

You should see `granite4:micro` in the output.

---

## Step 6: Write a Mellea app

Create a file called `app.py`:

```python
import mellea
from mellea.core import Requirement
from mellea.stdlib.requirements import simple_validate

m = mellea.start_session()  # defaults to Ollama and granite4:micro

length_req = Requirement(
    "The response must be at least 100 characters long.",
    validation_fn=simple_validate(
        lambda x: (
            len(x) >= 100,
            f"Response is only {len(x)} chars; must be at least 100.",
        )
    ),
)

email = m.instruct(
    "Write an email inviting the interns to a lunch party.",
    requirements=[length_req]
)

print(email)
```

`m.instruct()` takes a plain-language instruction and a list of `Requirement` objects. Each requirement has a validation function that checks the output and returns a `(passed, feedback)` tuple. If validation fails, Mellea feeds the feedback back to the model and retries — this is the Instruct-Validate-Repair (IVR) loop. Your code doesn't need to manage the retry logic; Mellea handles it.

---

## Step 7: Run the app

Make sure Ollama is running. If it isn't already, start it in a separate terminal:

```bash
ollama serve
```

Then run the app:

```bash
uv run app.py
```

You should see a well-formed email printed to the terminal. That's a complete Mellea pipeline: local model, structured output, automatic validation, no cloud required.

It should be noted that LLMs are stochastic in nature.  That, along with the initial prompt and requirements, may lead to the IVR loop succeeding on the first attempt or needing more retries.
You can view more details on how to modify [the sampling strategies here](https://docs.mellea.ai/concepts/instruct-validate-repair#sampling-strategies-and-the-ivr-loop).

---

## What's next

This example uses a single length requirement, but the same pattern scales to anything you can express in Python: JSON schema validation, regex matching, semantic checks, or calls to external APIs. The model doesn't change — only your `requirements` list does.

If you want to run Mellea against a cloud provider instead of Ollama, you can swap the backend:

```python
from mellea import MelleaSession
from mellea.backends.openai import OpenAIBackend

m = MelleaSession(backend=OpenAIBackend(model_id="gpt-4"))
```

You can check out [additional ways of using requirements](https://docs.mellea.ai/concepts/requirements-system).

Full documentation is at [docs.mellea.ai](https://docs.mellea.ai).

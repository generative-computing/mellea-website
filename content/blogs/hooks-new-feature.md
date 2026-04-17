---
title: "Hooks: A New Way to Extend Your LLM Application"
date: "2026-04-17"
author: "Paul Schweigert"
excerpt: "Hooks are a simple but powerful way to tap into your LLM application's lifecycle and add custom behavior without touching your core logic."
tags: ["v0.4", "hooks"]
---

Mellea v0.4.0 introduces **hooks** - a simple but powerful way to tap into your LLM application's lifecycle and add custom behavior without touching your core logic.

## The Problem

You're building an LLM application. It works great in development. But as you move toward production, you realize you need to:

- Track how much you're spending on API calls
- Log every request for compliance
- Block prompts that contain sensitive data
- Cache similar prompts to save money

You *could* wrap every LLM call with custom logic. But that gets messy fast. Your business logic becomes tangled with cross-cutting concerns.

**Hooks solve this.**

## What Are Hooks?

Hooks are callback functions that run at specific points in Mellea's execution flow. Think of them as event listeners for your LLM pipeline.

Here's a simple example - logging every LLM call:

```python
from mellea.plugins import hook, HookType, register

@hook(HookType.GENERATION_POST_CALL)
async def log_generation(payload, context):
    print(f"Model: {payload.model}")
    print(f"Tokens: {payload.model_output.usage.total_tokens}")
    print(f"Latency: {payload.latency_ms}ms")
    return payload

register(log_generation)
```

That's it. Now every LLM generation is logged automatically, without changing a single line of your application code.

## A Real Example: Cost Control

Let's say you want to prevent runaway costs. You can add a token budget enforcer:

```python
MAX_TOKENS_PER_SESSION = 100_000

@hook(HookType.GENERATION_PRE_CALL)
async def enforce_budget(payload, context):
    session_tokens = get_session_token_count()

    if session_tokens > MAX_TOKENS_PER_SESSION:
        # Block the request
        return block("Token budget exceeded")

    return payload

@hook(HookType.GENERATION_POST_CALL)
async def track_usage(payload, context):
    tokens = payload.model_output.usage.total_tokens
    increment_session_tokens(tokens)
    return payload
```

Now you have automatic budget enforcement. No wrapping, no middleware, no mess.

## Hook Points

Mellea provides hooks throughout the execution lifecycle:

- **Before and after** LLM generation
- **Before and after** tool invocations
- **During** sampling loops
- **At** session initialization and cleanup

Each hook receives a payload with relevant data (prompts, outputs, metadata) and can:

- **Observe** what's happening
- **Modify** some of the data flowing through
- **Block** execution if needed

## What Could You Build?

Once you start thinking in hooks, possibilities open up:

**Observability**: Send metrics to Prometheus. Create audit trails for compliance. Track which prompts are most expensive. (In fact, Mellea's built-in telemetry even uses hooks, when you enable `MELLEA_METRICS_ENABLED=true` a built-in plugin automatically tracks metrics like token consumption using the hooks system.)

**Quality**: Run multiple models and vote on the best output. Detect hallucinations by checking consistency. A/B test different models.

**Performance**: Cache semantically similar prompts. Route simple queries to fast models, complex ones to powerful models.

The beauty is that these concerns stay separate from your application logic. Want to add PII redaction? Register a hook. Want to remove it? Unregister. Your core code never changes.

## Getting Started

```bash
pip install mellea[hooks]
```

```python
from mellea.plugins import hook, HookType, register

@hook(HookType.GENERATION_POST_CALL)
async def my_hook(payload, context):
    # Your logic here
    return payload

register(my_hook)
```

That's all you need to start extending Mellea.

## What Will You Build?

We're excited to see what *you'll* build. Whether it's cost tracking, A/B testing, or something we haven't thought of yet - hooks make it easy to experiment.

What cross-cutting concerns are you wrestling with? What would you add to your LLM pipeline if it was just a few lines of code?

Hooks make it possible.

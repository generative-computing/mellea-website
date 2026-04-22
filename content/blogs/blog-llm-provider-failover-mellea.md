---
title: "Your LLM Provider is Down. Now What?"
date: "2026-04-22"
author: "Paul Schweigert"
excerpt: "Use mellea's provider-agnostic backend abstraction to build LLM applications that automatically survive outages through three layers of failover: validation retries, capability escalation (SOFAI), and infrastructure switching across providers."
tags: ["backends", "reliability"]
---

## Building model-agnostic AI applications that survive outages, lock-in, and the unexpected

You know the feeling: you're watching a Hacker News outage thread climb the front page and you realize it's your LLM provider. Your chatbot stops responding. Your extraction pipeline stalls. Users open support tickets. You refresh the status page and wait.

But outages aren't the only risk. Rate limits change overnight. Pricing doubles between billing cycles. Models get deprecated with 90 days' notice. Terms of service shift in ways that affect how you can use the outputs. If you've built production applications on a single LLM API, you've accepted all of these risks — not just downtime.

The outage is the urgent trigger, but the deeper problem is architectural coupling to a single vendor.

This post shows how to use [mellea](https://github.com/generative-computing/mellea), an open-source Python library for structured generative programs, to build LLM applications that are provider-agnostic by design — applications that survive outages automatically and give you the freedom to switch providers whenever the landscape shifts.

---

## The single-provider trap

Most LLM applications start like this:

```python
# The typical setup: one provider, one model, one prayer
import openai

client = openai.OpenAI(api_key="<your-api-key>")

def summarize(text: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": f"Summarize: {text}"}],
    )
    return response.choices[0].message.content
```

This works until it doesn't. When the API returns 503s, your only option is to wait. You could add retry logic with exponential backoff, but that only helps with transient blips, not the 45-minute outages that spawn Hacker News threads.

The deeper problem is architectural. Your inference logic, your prompt engineering, and your provider are fused into one block of code. Switching to Anthropic or a local model during an outage means rewriting the call signature, reformatting prompts, and re-testing, all under pressure at 2 AM while Slack is on fire.

And it's not just outages. You're locked into one provider's pricing, rate limits, deprecation timeline, and terms of service. When a better model launches on a competing platform, or your provider changes pricing, the switching cost is the same: a rewrite under pressure.

What you actually want is to swap the backend and keep everything else the same.

---

## How mellea separates inference from infrastructure

Mellea is a Python library for writing *generative programs*: structured, testable AI workflows with type-annotated outputs, validatable requirements, and automatic retries. But the feature that matters for failover is simpler: every backend implements the same interface.

Whether you're calling Claude through AWS Bedrock, GPT-4 through OpenAI, or Granite running locally via Ollama, your application code doesn't change. The `Backend` abstract class defines two methods (`generate_from_context()` and `generate_from_raw()`) and every provider adapter implements them identically.

Because every backend implements the same interface, switching from a cloud API to a local model is a one-line change — no other code needs to be touched:

```python
from mellea import MelleaSession
from mellea.backends.ollama import OllamaModelBackend
from mellea.backends.openai import OpenAIBackend

# Production: cloud provider
session = MelleaSession(backend=OpenAIBackend(model_id="gpt-4"))

# Failover: local model, same interface
session = MelleaSession(backend=OllamaModelBackend("granite4:latest"))

# Your application code is identical in both cases
result = session.instruct("Summarize this quarterly report.")
print(str(result))
```

No prompt reformatting. No API signature changes. Just a different backend object.

This works in practice — not just in theory — because mellea's programming model is inherently model-agnostic. Prompts are short and declarative: you call `m.instruct()` with a plain-language instruction and a list of `requirements`, not a carefully tuned system prompt designed around one model's quirks. Output correctness is verified by Python validation functions (`validation_fn`), not by trusting that a specific model will format things the right way. The result is that your application's behavior is defined by your code and your validators, not by which model happens to be running underneath. Switching providers isn't just mechanically possible — it works because nothing in the application layer depends on model-specific behavior.

If you've used [LiteLLM](https://docs.litellm.ai/), the backend-swapping part may sound familiar — LiteLLM gives you a unified calling convention across providers, and mellea can use it as one of its backends. Where mellea goes further is above the routing layer: validating outputs, retrying with feedback, and escalating across model tiers based on output quality, not just availability. The next section shows what that looks like.

---

## Three layers of failover

Mellea gives you three strategies for handling failures, each at a different level. You can use them independently or stack them.

### Layer 1: Retry with validation feedback

The most common failure isn't an outage. It's a bad output. The model returns malformed JSON, skips a required field, or hallucinates a value. Mellea's Instruct-Validate-Repair (IVR) loop handles this automatically:

```python
import json
from mellea import start_session
from mellea.stdlib.requirements import req
from mellea.stdlib.sampling import RejectionSamplingStrategy

m = start_session("ollama", model_id="granite4:latest")

def is_valid_json(ctx) -> tuple[bool, str]:
    text = str(ctx.last_output())
    try:
        json.loads(text)
        return (True, "")
    except json.JSONDecodeError as e:
        return (False, f"Invalid JSON: {e}")

result = m.instruct(
    "Generate a JSON config with keys: name, port, debug. "
    "Output ONLY the raw JSON object, no markdown fences or extra text.",
    requirements=[
        req("Output must be valid JSON.", validation_fn=is_valid_json)
    ],
    strategy=RejectionSamplingStrategy(loop_budget=3),
    return_sampling_results=True,
)

if result.success:
    config = json.loads(str(result))
    print(f"Got valid config after {len(result.sample_generations)} attempt(s)")
    print(json.dumps(config, indent=2))
else:
    print(f"Failed after {len(result.sample_generations)} attempts")
```

Output:

```text
Got valid config after 1 attempt(s)
{
  "name": "my-service",
  "port": 8080,
  "debug": false
}
```

This handles the 80% case: transient quality failures within a single provider. When the provider itself is down, you need the next layer.

### Layer 2: Capability escalation with SOFAI

SOFAI (System 1 / System 2 Architecture for AI) is mellea's dual-model strategy. It tries a fast, cheap model first (S1), and if that fails validation after multiple attempts, it escalates to a slower, more capable model (S2):

```python
from mellea import MelleaSession
from mellea.backends.ollama import OllamaModelBackend
from mellea.backends.openai import OpenAIBackend
from mellea.stdlib.sampling import SOFAISamplingStrategy
from mellea.stdlib.context import ChatContext

# S1: fast local model (free, private, always available)
s1 = OllamaModelBackend("granite4:micro")

# S2: powerful cloud model (paid, but handles hard tasks)
s2 = OpenAIBackend(model_id="gpt-4")

strategy = SOFAISamplingStrategy(
    s1_solver_backend=s1,
    s2_solver_backend=s2,
    s2_solver_mode="fresh_start",  # S2 gets clean context
    loop_budget=3,                  # 3 S1 attempts before escalation
)

m = MelleaSession(backend=s1, ctx=ChatContext())
result = m.instruct(
    "Write a SQL query that finds the top 10 customers by "
    "lifetime value, excluding refunded orders, with a "
    "running total column.",
    requirements=[
        req("Must be valid SQL with a window function."),
        req("Must exclude refunded orders via WHERE or JOIN."),
    ],
    strategy=strategy,
    return_sampling_results=True,
)

print(str(result.result))
```

SOFAI is designed for capability escalation: use the expensive model only when the cheap one can't handle the task. But it doubles as a failover mechanism. If your S1 and S2 backends use different providers, a provider outage on one side is handled by escalation to the other.

The three escalation modes control how much context S2 inherits:

| Mode | S2 sees | Best for |
| ---- | ------- | -------- |
| `fresh_start` | Only the original prompt | Tasks where S1's failed attempts would confuse S2 |
| `continue_chat` | Full S1 conversation history | Tasks where S1 made partial progress worth continuing |
| `best_attempt` | S1's highest-scoring attempt | Tasks where S1 was close but needs refinement |

### Layer 3: Infrastructure failover across providers

For full outage resilience, you need to switch providers entirely. Mellea's uniform backend interface makes this straightforward:

```python
from mellea import MelleaSession
from mellea.backends.ollama import OllamaModelBackend
from mellea.backends.openai import OpenAIBackend
from mellea.backends.litellm import LiteLLMBackend

# Define your backend priority order
BACKENDS = [
    ("Anthropic (via LiteLLM)",
     lambda: LiteLLMBackend("anthropic/claude-sonnet-4-20250514")),
    ("OpenAI",
     lambda: OpenAIBackend(model_id="gpt-4")),
    ("Ollama (local)",
     lambda: OllamaModelBackend("granite4:latest")),
]

def create_resilient_session() -> MelleaSession:
    """Try each backend in priority order until one responds."""
    for name, make_backend in BACKENDS:
        try:
            backend = make_backend()
            session = MelleaSession(backend=backend)
            # Probe the connection with a cheap call
            session.instruct("Say 'ok'.")
            print(f"Connected via {name}")
            return session
        except Exception as e:
            print(f"{name} unavailable: {e}")
    raise RuntimeError("All backends unavailable")

# Your application code doesn't know or care which provider is active
session = create_resilient_session()
result = session.instruct(
    "Analyze this support ticket and classify its priority."
)
print(str(result))
```

Output when the primary provider is down:

```text
Anthropic (via LiteLLM) unavailable: Connection error: status 503
OpenAI unavailable: Connection error: status 503
Connected via Ollama (local)
```

The local Ollama backend is your last line of defense. It's slower and less capable than the cloud models, but it's *yours*. No external dependency, no status page to watch.

This manual fallback loop is simple by design — it's the same pattern you could build with LiteLLM's [router](https://docs.litellm.ai/docs/routing-load-balancing) or a try/except around any HTTP client. The real payoff comes from stacking it with the validation and escalation layers above.

---

## Using LiteLLM as a routing layer

LiteLLM is a proxy layer that provides a unified API across 100+ LLM providers. Mellea's `LiteLLMBackend` wraps it, so you can reach Anthropic, Azure, Bedrock, Cohere, and dozens more through a single backend class by changing the model ID string:

```python
from mellea.backends.litellm import LiteLLMBackend

# All of these use the same LiteLLMBackend class:
anthropic = LiteLLMBackend("anthropic/claude-sonnet-4-20250514")
bedrock   = LiteLLMBackend("bedrock/converse/us.amazon.nova-pro-v1:0")
azure     = LiteLLMBackend("azure/<your-deployment-name>")
cohere    = LiteLLMBackend("cohere/command-r-plus")
```

This collapses the failover problem further. You don't need separate backend classes for each provider. You can build a failover chain entirely within `LiteLLMBackend` by varying the model ID prefix.

LiteLLM handles *which provider receives the request*. Mellea handles *what happens when the response comes back wrong* — validation, repair, and escalation. They're complementary: LiteLLM is the routing layer, mellea is the application layer above it.

---

## Putting it all together

Here's the full pattern: a session that combines all three layers. Validation retries catch bad outputs. SOFAI escalation catches capability gaps. And if the cloud is entirely down, a local model keeps things running:

```python
from mellea import MelleaSession
from mellea.backends.ollama import OllamaModelBackend
from mellea.backends.litellm import LiteLLMBackend
from mellea.stdlib.sampling import SOFAISamplingStrategy
from mellea.stdlib.requirements import req
from mellea.stdlib.context import ChatContext

def build_resilient_pipeline():
    """Three-layer failover: retry, escalate, switch provider."""

    # Layer 3: pick the best available cloud backend
    cloud_backend = None
    for model_id in [
        "anthropic/claude-sonnet-4-20250514",
        "bedrock/converse/us.amazon.nova-pro-v1:0",
        "openai/gpt-4",
    ]:
        try:
            candidate = LiteLLMBackend(model_id)
            # ... probe connection ...
            cloud_backend = candidate
            print(f"Cloud backend: {model_id}")
            break
        except Exception as e:
            print(f"{model_id}: {e}")

    # Local backend is always available
    local_backend = OllamaModelBackend("granite4:latest")

    # Layer 2: SOFAI escalation (local then cloud)
    if cloud_backend:
        strategy = SOFAISamplingStrategy(
            s1_solver_backend=local_backend,   # Try local first (fast, free)
            s2_solver_backend=cloud_backend,   # Escalate to cloud if needed
            s2_solver_mode="fresh_start",
            loop_budget=2,                     # 2 local attempts, then cloud
        )
    else:
        print("No cloud backend available; running local-only")
        strategy = None  # Fall back to default retry strategy

    session = MelleaSession(backend=local_backend, ctx=ChatContext())
    return session, strategy

# Application code
session, strategy = build_resilient_pipeline()

# Layer 1: validation retries happen automatically within each layer
result = session.instruct(
    "Extract all action items from this meeting transcript.",
    requirements=[
        req("Output must be a numbered list."),
        req("Each item must include an assignee name."),
    ],
    strategy=strategy,
    return_sampling_results=True,
)

print(str(result.result))
```

## What this doesn't solve

Failover has real trade-offs:

**Quality degradation.** Your local Granite model won't match Claude or GPT-4 on complex reasoning. Failover keeps the lights on, but at lower quality. Design your application to handle degraded outputs: shorter summaries, simpler classifications, "I need a human to review this" flags.

**Feature parity gaps.** Not every provider supports tool calling, structured output, or vision in the same way. Test your failover path with the same inputs you use in production, not just "hello world."

**Cold-start latency.** Switching backends mid-request adds latency. For real-time applications, consider maintaining warm connections to your top two providers rather than probing on failure.

**Local model overhead.** Running Ollama as a fallback requires a machine with enough RAM/VRAM to host the model. A 3B parameter model like Granite Micro needs ~4 GB. Plan your infrastructure accordingly.

---

## Stop building single points of failure

We learned this with databases decades ago, and with CDNs. LLM providers are no different. If your application depends on a network call, it needs a plan for when that call fails — or when you simply want to stop making it.

This isn't just about surviving outages. It's about maintaining the freedom to choose the best model for the job as the landscape shifts. Whether it's a 45-minute outage, a pricing change, or a better model launching on a competing platform tomorrow, your architecture should let you move.

Mellea's backend abstraction and model-agnostic programming model make this practical: write your generative programs once against a uniform interface with declarative requirements and Python-based validation, then configure which providers serve them. The code doesn't change. Just the backend.

If you've watched an outage thread climb Hacker News while your application sat dead alongside it, [get started here](https://docs.mellea.ai). The guide takes about five minutes.

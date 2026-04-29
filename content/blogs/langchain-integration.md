---
title: "What Mellea Brings to LangChain: Structured Generative Programming for Reliable AI Applications"
date: "2026-04-27"
author: "Akihiko Kuroda"
excerpt: "Learn how Mellea's generative programming patterns add structured validation, automatic retry, and inference-time scaling to LangChain applications."
tags: ["langchain", "mellea", "generative-programming", "llm", "validation", "reliability"]
---

LangChain makes it easy to build LLM applications with chains, agents, and tools. But in production, outputs rarely meet requirements on the first try.

The **Mellea-LangChain integration** solves this by adding automatic validation, structured requirements, and intelligent retry logic to your LangChain workflows.

> **Before you start:** Mellea trades latency and API costs for output quality. Expect 2-5x slower responses due to validation retries, and higher token usage. Streaming is not supported—responses return as a single chunk. This is ideal for batch processing and quality-critical applications, but not for real-time chat or latency-sensitive systems.

## Getting Started

### Installation

First, follow [Mellea's Getting Started guide](https://docs.mellea.ai/getting-started) to set up your environment (including Ollama if running locally).

Then install the LangChain integration:

```bash
# 1. Install mellea and langchain
pip install mellea langchain

# 2. Install mellea-integration-core
pip install https://github.com/generative-computing/mellea-contribs/releases/download/mellea-integration-core/v0.1.0/mellea_integration_core-0.1.0-py3-none-any.whl

# 3. Install mellea-langchain
pip install https://github.com/generative-computing/mellea-contribs/releases/download/mellea-langchain/v0.1.0/mellea_langchain-0.1.0-py3-none-any.whl
```

### Your First Validated Chain

```python
from mellea import start_session
from mellea_langchain import MelleaChatModel
from mellea.stdlib.requirements import req
from mellea.stdlib.sampling import RejectionSamplingStrategy
from langchain_core.prompts import ChatPromptTemplate

# Create Mellea session
m = start_session()  # Uses Ollama by default

# Create validated LangChain model
chat_model = MelleaChatModel(mellea_session=m)

# Create a chain with requirements
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    ("human", "{input}")
])

# Attach requirements using bind()
model_with_requirements = chat_model.bind(
    model_options={
        "requirements": [
            req("Response must be helpful and accurate"),
            req("Response must be concise"),
        ],
        "strategy": RejectionSamplingStrategy(loop_budget=3),
    }
)

validated_chain = prompt | model_with_requirements

# Use it!
result = validated_chain.invoke({"input": "Explain quantum computing"})
print(result.content)
```

## The Problem

Most LangChain applications follow this pattern:

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

model = ChatOpenAI()
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant"),
    ("human", "{query}")
])

chain = prompt | model
result = chain.invoke({"query": "Write a product review"})
print(result.content)  # May or may not meet quality standards
```

**LangChain generates once and returns whatever it gets.** This creates problems:

- Manual validation loops — you write code to check output quality and retry
- Scattered validation logic — format checks, semantic validation, and retries live across the codebase
- No feedback on failures — if validation fails, you restart with no context about what went wrong
- Hard to debug — you see pass/fail but not why a specific requirement failed

If you want reliable outputs, you end up writing retry logic like this:

```python
max_attempts = 5
for attempt in range(max_attempts):
    result = chain.invoke({"query": "Write a professional email"})
    
    # Manual validation checks
    word_count = len(result.content.split())
    is_professional = "Dear" in result.content
    has_closing = "Sincerely" in result.content
    
    if 50 < word_count < 300 and is_professional and has_closing:
        break  # Success
    # Otherwise retry
else:
    print("Failed after max attempts")
```

This doesn't scale. Each new validation rule requires code changes, and each failure is a mystery.

## The Guardrails AI Approach

Many projects use **Guardrails AI**:

```python
from guardrails import Guard
from langchain_core.prompts import ChatPromptTemplate

# Define guardrails
guardrail = Guard.from_rail_string("""
<rail version="0.1">
<output>
    <string name="response"
            validators="length: 50 300"
            on-fail="reask"/>
</output>
</rail>
""")

chain = prompt | model
result = chain.invoke({"query": "Write a professional email"})
validated = guardrail.validate(result.content)

if not validated.passed:
    # Manual retry
    result = chain.invoke({"query": "Write a professional email"})
```

This works for **rule-based validation** (length, format, regex) but can't do semantic checks. Guardrails runs *after* generation, so retries lose context. You still write retry code for each use case. When something fails, you get pass/fail but no insight into why.

For reliable outputs, you need validation *during* generation with intelligent retry strategies.

## How Mellea Works

Mellea integrates validation directly into generation using the instruct-validate-repair pattern. See the [Mellea docs](https://docs.mellea.ai/) for details.

### Side-by-Side: LangChain vs. Mellea

Let's say you're building a customer service email generator. Here's how pure LangChain handles it:

**Pure LangChain with Manual Retry:**

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

model = ChatOpenAI()
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a professional customer service representative."),
    ("human", "Write a response to this customer issue: {issue}")
])

chain = prompt | model

# Manual retry logic
max_attempts = 5
for attempt in range(max_attempts):
    result = chain.invoke({"issue": "My order hasn't arrived"})
    content = result.content
    
    # Check requirements manually
    is_professional = all(w in content for w in ["Dear", "sincerely"])
    word_count = len(content.split())
    has_action = any(word in content.lower() for word in ["track", "investigate", "refund"])
    
    if is_professional and 100 < word_count < 500 and has_action:
        print(content)
        break
else:
    print("Failed to generate acceptable response after 5 attempts")
```

**The same task with Mellea:**

```python
from mellea import start_session
from mellea_langchain import MelleaChatModel
from mellea.stdlib.requirements import req, simple_validate
from mellea.stdlib.sampling import RejectionSamplingStrategy
from langchain_core.prompts import ChatPromptTemplate

m = start_session()
chat_model = MelleaChatModel(mellea_session=m)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a professional customer service representative."),
    ("human", "Write a response to this customer issue: {issue}")
])

# Define requirements once, let Mellea handle retries
model_with_requirements = chat_model.bind(
    model_options={
        "requirements": [
            req("Must be professional with greeting and closing"),
            req("Must include action steps to resolve the issue"),
            req("Between 100-500 words", 
                validation_fn=simple_validate(lambda x: 100 < len(x.split()) < 500)),
        ],
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)

chain = prompt | model_with_requirements
result = chain.invoke({"issue": "My order hasn't arrived"})
print(result.content)
```

**What changed:**

| Aspect | LangChain | Mellea |
| ------ | --------- | ------ |
| **Retry logic** | Manual loop with if/else | Automatic via `RejectionSamplingStrategy` |
| **Validation** | Hardcoded checks in loop | Declarative `req()` statements |
| **Debugging** | Pass/fail only | See which requirements failed at each attempt |
| **Reusability** | Validation code coupled to this chain | Requirements can be reused across chains |
| **Semantic validation** | Manual string checks | LLM-based validation via `req()` |

The tradeoff: Mellea replaces manual validation loops with declarative requirements, but generation takes 2-5x longer.

Here's what it looks like in practice:

### Automatic Validation and Retry

Instead of writing retry loops, Mellea handles them automatically:

```python
from mellea import start_session
from mellea_langchain import MelleaChatModel
from mellea.stdlib.requirements import req
from mellea.stdlib.sampling import RejectionSamplingStrategy
from langchain_core.prompts import ChatPromptTemplate

# Create Mellea-powered LangChain model
m = start_session()
chat_model = MelleaChatModel(mellea_session=m)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant"),
    ("human", "{query}")
])

# Attach requirements using bind()
model_with_requirements = chat_model.bind(
    model_options={
        "requirements": [
            req("Must be professional and helpful"),
            req("Must be between 50-300 words", 
                validation_fn=simple_validate(lambda x: 50 < len(x.split()) < 300)),
            req("Must include a greeting",
                validation_fn=simple_validate(lambda x: "Dear" in x)),
        ],
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)

chain = prompt | model_with_requirements
result = chain.invoke({"query": "Write a professional email"})
# Retried up to 5 times automatically; guaranteed to meet requirements
```

That's it—no manual retry logic. Mellea validates and retries automatically with clear feedback.

### Sampling Strategies

Different strategies trade compute for quality. Pick the right one for your use case:

```python
from mellea.stdlib.sampling import (
    RejectionSamplingStrategy,
    MultiTurnStrategy,
    RepairTemplateStrategy
)
from mellea.stdlib.requirements import req

# Rejection Sampling: Keep trying until requirements are met (up to loop_budget)
response = chat_model.invoke(
    messages,
    model_options={
        "requirements": [req("Must be professional")],
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)

# Multi-Turn Strategy: Agentic repair with conversation
response = chat_model.invoke(
    messages,
    model_options={
        "requirements": [req("Must be professional")],
        "strategy": MultiTurnStrategy(loop_budget=3),
    }
)

# Repair Template Strategy: Adds repair instructions to failed attempts
response = chat_model.invoke(
    messages,
    model_options={
        "requirements": [req("Must be professional")],
        "strategy": RepairTemplateStrategy(loop_budget=3),
    }
)
```

LangChain doesn't have this built-in.

### Mixing Semantic and Deterministic Checks

Combine fast rules with semantic validation:

```python
from mellea.stdlib.requirements import req, check, simple_validate

# LLM-validated semantic checks (slower but flexible)
semantic_requirements = [
    req("The email should be professional"),
    req("The tone should be friendly but formal"),
]

# Deterministic checks (fast, < 1ms, no LLM call)
deterministic_requirements = [
    req("Under 200 words", validation_fn=simple_validate(lambda x: len(x.split()) < 200)),
    req("Must include email address", validation_fn=simple_validate(lambda x: "@" in x)),
]

all_requirements = semantic_requirements + deterministic_requirements

response = chat_model.invoke(
    messages,
    model_options={
        "requirements": all_requirements,
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)
```

Deterministic checks run instantly. Semantic checks cost an extra LLM call but catch nuance that string matching misses. For more on `req()` vs `check()`, see the [Mellea Meets AI Frameworks](./agentic-framework-integrations.md) post.

## Reusable Requirements

With Mellea, define validation rules once and use them across multiple chains. With manual retry loops, each chain gets its own validation code.

```python
# Define reusable requirement sets
professional_requirements = [
    req("Must have a professional greeting"),
    req("Must be formal in tone"),
]

concise_requirements = [
    req("Under 200 words", validation_fn=simple_validate(lambda x: len(x.split()) < 200)),
    req("At least 50 words", validation_fn=simple_validate(lambda x: len(x.split()) > 50)),
]

# Compose once, reuse everywhere
email_requirements = professional_requirements + concise_requirements

# Attach to model before building chain
model_with_requirements = chat_model.bind(
    model_options={
        "requirements": email_requirements,
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)

# Use in multiple chains
customer_email_chain = prompt1 | model_with_requirements
result1 = customer_email_chain.invoke({"customer": "John", "issue": "billing"})

internal_email_chain = prompt2 | model_with_requirements
result2 = internal_email_chain.invoke({"topic": "quarterly review"})
# Both automatically retry with the same requirements
```

## When to Use Mellea

Use Mellea for quality-critical applications where you accept 2-5x latency for reliable outputs—structured content like emails and reports where semantic validation matters. Skip it for real-time chat (users expect fast responses), high-volume APIs (each retry adds cost), or streaming (Mellea doesn't support it).

Each validation retry costs API credits. Semantic validation quality depends on your validator model's ability to judge the specific requirements you define. For minimal overhead, stick with format-only guardrails. For one-off cases, manual retry logic is simpler.

## The Architecture

MelleaChatModel wraps your LLM backend and adds an instruct-validate-repair loop. It handles retries, tracks validation results, and swaps backends (Ollama, OpenAI, etc.) transparently.

## Attaching Requirements to Your Chain

When building chains in LangChain, use the [`bind()` method](https://python.langchain.com/docs/how_to/binding/) to attach `model_options` before composing the chain:

```python
# Correct: bind() before building the chain
model_with_requirements = chat_model.bind(
    model_options={
        "requirements": [...],
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)
chain = prompt | model_with_requirements
result = chain.invoke(input)

# Wrong: model_options in invoke() are not forwarded to the model
chain = prompt | chat_model
result = chain.invoke(input, model_options={...})  # Won't work!
```

**Why?** LangChain's `RunnableSequence.invoke()` only forwards `**kwargs` to the first step in the pipe (the prompt template). Use `bind()` to attach options before building the chain so they're available when the model runs.

## Next Steps

Copy the "Your First Validated Chain" example above, save it as `validated_chain.py`, and run it:

```bash
python validated_chain.py
```

Learn more:

- [Mellea Documentation](https://docs.mellea.ai/)
- [Integration Examples](https://github.com/generative-computing/mellea-contribs/tree/main/mellea_contribs/langchain_backend/examples)
- [LangChain Docs](https://python.langchain.com/)
- [Mellea Discord Community](https://ibm.biz/mellea-discord)

---

This integration is part of [mellea-contribs](https://github.com/generative-computing/mellea-contribs), an incubation point for Mellea ecosystem contributions.

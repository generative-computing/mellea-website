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
from langchain_core.messages import HumanMessage

# Create Mellea session
m = start_session()  # Uses Ollama by default

# Create validated LangChain model
chat_model = MelleaChatModel(mellea_session=m)

# Create a chain with requirements
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    ("human", "{input}")
])

validated_chain = prompt | chat_model

# Use it!
result = validated_chain.invoke(
    {"input": "Explain quantum computing"},
    model_options={
        "requirements": [
            req("Response must be helpful and accurate"),
            req("Response must be concise"),
        ],
        "strategy": RejectionSamplingStrategy(loop_budget=3),
    }
)
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

Mellea integrates validation directly into generation using the instruct-validate-repair pattern. See the [Mellea docs](https://docs.mellea.ai/) for details. Here's what it looks like in practice:

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

You get both speed (deterministic checks) and power (semantic validation). See the [Mellea Meets AI Frameworks](./agentic-framework-integrations.md) post for details on `req()` vs `check()`.

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

## Semantic Validation

Guardrails can only check rules. Mellea uses the LLM as a judge, validating tone, intent, and semantic quality during generation, not after:

```python
# LLM-based semantic validation (powerful but costs API calls)
semantic = [
    req("Must be professional and empathetic"),
    req("Must directly address the customer's issue"),
]

# Deterministic checks (fast, < 1ms, no LLM)
deterministic = [
    req("Must include a closing", 
        validation_fn=simple_validate(lambda x: "Sincerely" in x or "Best regards" in x)),
]

# Use both together
model_with_validation = chat_model.bind(
    model_options={
        "requirements": semantic + deterministic,
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)

chain = prompt | model_with_validation
result = chain.invoke({"issue": "payment failed"})
```

## Transparent Feedback

When validation fails, Mellea shows you exactly which requirements passed and which failed at each attempt:

```python
response = chat_model.invoke(
    messages,
    model_options={
        "requirements": [
            req("Must be exactly 3 sentences"),
            req("Must mention 'quantum computing'"),
            req("Under 50 words", validation_fn=simple_validate(lambda x: len(x.split()) < 50)),
        ],
        "strategy": RejectionSamplingStrategy(loop_budget=5),
        "return_sampling_results": True,
    }
)

# During generation, you see:
# ATTEMPT 1: FAILED. Valid: 2/3 requirements. Failed:
#     - Must be exactly 3 sentences
# ATTEMPT 2: FAILED. Valid: 2/3 requirements. Failed:
#     - Must be exactly 3 sentences
# ...
# BEST RESULT selected after 5 attempts
```

## The @generative Decorator

Instead of writing validation functions or LangChain tools, use Mellea's `@generative` decorator:

```python
from mellea import start_session, generative
from typing import Literal

m = start_session()

# Instead of writing a validation function, declare what it should do
@generative
def classify_sentiment(text: str) -> Literal["positive", "negative", "neutral"]:
    """Classify the sentiment of the input text."""

# Use it like a regular function
sentiment = classify_sentiment(m, text="I love this product!")
print(sentiment)  # Output: positive

# Another example: email categorization
@generative
def categorize_email(subject: str, body: str) -> Literal["urgent", "normal", "spam"]:
    """Categorize an email based on its subject and body."""

category = categorize_email(m,
    subject="URGENT: Server Down",
    body="Our production server is down."
)
print(category)  # Output: urgent
```

Use `@generative` for classification and extraction. Use LangChain tools for multi-step agent workflows. Here's the difference:

```python
# Without Mellea (LangChain tool)
from langchain_core.tools import tool

@tool
def validate_email_format(email: str) -> str:
    """Validate if email has a professional greeting."""
    # You implement this...
    if email.startswith("Dear"):
        return "valid"
    return "invalid"

# With Mellea (@generative)
@generative
def check_email_format(email: str) -> Literal["valid", "invalid"]:
    """Check if email has a professional greeting and sign-off."""

result = check_email_format(m, email="Dear John, ... Best regards, Alice")
# Output: valid
```

## The Trade-off

Manual retry loops are simple for one-off cases. Guardrails add minimal overhead but only check rules. Mellea costs 2-5x more latency in exchange for semantic validation during generation, not after.

## Using Mellea with Other Tools

Combine Mellea's semantic validation with deterministic guardrails:

```python
from mellea import start_session
from mellea_langchain import MelleaChatModel, MelleaGuardrail
from mellea.stdlib.requirements import req
from mellea.stdlib.sampling import RejectionSamplingStrategy

m = start_session()
chat_model = MelleaChatModel(mellea_session=m)

# Deterministic post-generation checks
def no_sensitive_data(text: str) -> bool:
    """Reject if contains sensitive info."""
    return not any(word in text.lower() for word in ["password", "ssn"])

post_guardrail = MelleaGuardrail(
    requirements=[no_sensitive_data],
    name="security_check"
)

chain = prompt | chat_model

# Generate with semantic validation + automatic retry
result = chain.invoke(
    {"input": "..."},
    model_options={
        "requirements": [
            req("Must be professional and helpful"),
            req("Must address the customer's issue"),
        ],
        "strategy": RejectionSamplingStrategy(loop_budget=3),
    }
)

# Apply deterministic post-checks
validation = post_guardrail.validate(result.content)
if not validation.passed:
    print(f"Security check failed: {validation.errors}")
```

## When to Use Mellea

Use Mellea for quality-critical applications where you accept 2-5x latency for reliable outputs. Use it for structured content like emails and reports where semantic validation matters. Skip it for real-time chat (users expect fast responses), high-volume APIs (each retry adds cost), or streaming (Mellea doesn't support it).

For minimal overhead, use format-only guardrails. For one-off cases, write manual retry logic.

## Tradeoffs

- Streaming is not supported
- Validation adds 2-5x latency
- Each retry costs API credits
- Semantic validation quality depends on your validator model

Pick your strategy: prioritize speed (skip Mellea), reliability (use Mellea), or cost (use minimal retries).

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

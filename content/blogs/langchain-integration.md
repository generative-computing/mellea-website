---
title: "What Mellea Brings to LangChain: Structured Generative Programming for Reliable AI Applications"
date: "2026-04-30"
author: "Akihiko Kuroda"
excerpt: "Learn how Mellea's generative programming patterns add structured validation, automatic retry, and inference-time scaling to LangChain applications."
tags: ["langchain", "generative-programming", "llm", "validation", "reliability"]
---

LangChain makes it easy to build LLM applications with chains, agents, and tools. But outputs rarely meet requirements on the first try.

The **Mellea-LangChain integration** adds automatic validation, structured requirements, and intelligent retry logic to your LangChain workflows.

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

> **Note:** Some examples depend on `langchain-ollama` and `guardrails-ai` packages to demonstrate LangChain implementation patterns. These packages are **not necessary** for the Mellea LangChain integration itself. Install them only if you plan to run through all examples in this blog.

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

chain = prompt | model_with_requirements
result = chain.invoke({"input": "Explain quantum computing"})
print(result.content)
```

## The Problem

Most LangChain applications follow this pattern:

```python
# Note: Requires langchain-ollama package
# pip install langchain-ollama
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama

model = ChatOllama(model="granite4:micro")
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant"),
    ("human", "{query}")
])

chain = prompt | model
result = chain.invoke({"query": "Write a product review"})
print(result.content)  # May or may not meet quality standards
```

**LangChain generates once and returns whatever it gets.** You end up with manual validation loops scattered across the codebase, hardcoded format checks scattered among multiple chains, and no feedback on what specifically failed when validation rejects an output.

You end up writing retry logic like this:

```python
# Note: Requires langchain-ollama package
# pip install langchain-ollama
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

This is tedious. Each new validation rule requires code changes, and each failure gives you pass/fail with no detail on what went wrong.

## The Guardrails AI Approach

**Guardrails AI** handles format-based checks (length, regex, schema):

```python
# Note: Requires guardrails-ai package
# pip install guardrails-ai
from guardrails import Guard, Validator, register_validator
from guardrails.validator_base import FailResult, PassResult, ValidationResult

@register_validator(name="length_check", data_type="string")
class LengthCheck(Validator):
    def __init__(self, min_len: int = 50, max_len: int = 300, **kwargs):
        super().__init__(**kwargs)
        self.min_len = min_len
        self.max_len = max_len

    def validate(self, value: str, metadata: dict) -> ValidationResult:
        word_count = len(value.split())
        if self.min_len <= word_count <= self.max_len:
            return PassResult()
        return FailResult(
            error_message=f"Length {word_count} not in range [{self.min_len}, {self.max_len}]"
        )

guard = Guard().use(LengthCheck(min_len=50, max_len=300))
result = chain.invoke({"query": "Write a professional email"})
validated = guard.validate(result.content)
```

But it validates *after* generation completes, so retries lose context. You still need to write retry logic, and semantic checks (tone, clarity, logical flow) aren't part of the system. What you really need is validation *during* generation, not after.

## How Mellea Works

Mellea bakes validation into the generation loop itself. See the [Mellea docs](https://docs.mellea.ai/) for the full instruct-validate-repair pattern.

### Side-by-Side: LangChain vs. Mellea

Let's say you're building a customer service email generator. Here's how pure LangChain handles it:

**Pure LangChain with Manual Retry:**

```python
# Note: Requires langchain-ollama package
# pip install langchain-ollama
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama

model = ChatOllama(model="granite4:micro")
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

**With Mellea, the same task:**

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

### Automatic Validation and Retry

The first code example at the top already shows this in action. No manual loops—just define requirements and let Mellea handle retries, with feedback on what failed at each step.

### Sampling Strategies

Different strategies trade compute for quality. Pick the right one for your use case:

```python
from mellea.stdlib.sampling import (
    RejectionSamplingStrategy,
    MultiTurnStrategy,
    RepairTemplateStrategy
)
from mellea.stdlib.requirements import req
from langchain_core.messages import HumanMessage

messages = [HumanMessage(content="Write a professional email")]

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

### Mixing Semantic and Deterministic Checks

Combine fast rules with semantic validation:

```python
from mellea.stdlib.requirements import req, simple_validate

# LLM-validated checks (requires extra API call)
semantic_requirements = [
    req("The email should be professional"),
    req("The tone should be friendly but formal"),
]

# Deterministic checks (instant, no API call)
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

Deterministic checks are instant. LLM-based checks cost an extra API call but can evaluate semantic qualities (tone, logical flow, professionalism) that regex or string matching can't. For more on `req()` vs `check()`, see the [Mellea Meets AI Frameworks](./agentic-framework-integrations.md) post.

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

# Define prompts for different use cases
prompt1 = ChatPromptTemplate.from_messages([
    ("system", "You are a customer service representative."),
    ("human", "Write a response to {customer}'s issue: {issue}")
])

prompt2 = ChatPromptTemplate.from_messages([
    ("system", "You are a professional document writer."),
    ("human", "Write an internal memo about: {topic}")
])

# Use in multiple chains
customer_email_chain = prompt1 | model_with_requirements
result1 = customer_email_chain.invoke({"customer": "John", "issue": "billing"})

internal_email_chain = prompt2 | model_with_requirements
result2 = internal_email_chain.invoke({"topic": "quarterly review"})
# Both automatically retry with the same requirements
```

## When to Use Mellea

Mellea fits batch processing, report generation, and email workflows where you control latency and each token counts. Skip it for real-time chat, high-volume APIs (retries add cost), or streaming (not supported).

LLM-based validation requires extra API calls, so the accuracy of your requirements matters. If you're just doing format checks, Guardrails is lighter. If you're generating one-off responses or have strict latency limits, manual retry logic or Guardrails may be easier.

## Next Steps

Copy the "Your First Validated Chain" example at the top, save it as `validated_chain.py`, and run it.

For more, see the [Mellea docs](https://docs.mellea.ai/), [LangChain integration examples](https://github.com/generative-computing/mellea-contribs/tree/main/mellea_contribs/langchain_backend/examples), and the [Mellea Discord](https://ibm.biz/mellea-discord).

This integration lives in [mellea-contribs](https://github.com/generative-computing/mellea-contribs).

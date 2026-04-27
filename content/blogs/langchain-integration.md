---
title: "What Mellea Brings to LangChain: Structured Generative Programming for Reliable AI Applications"
date: "2026-04-27"
author: "Akihiko Kuroda"
excerpt: "Learn how Mellea's generative programming patterns add structured validation, automatic retry, and inference-time scaling to LangChain applications."
tags: ["langchain", "mellea", "generative-programming", "llm", "validation", "reliability"]
---

LangChain makes it easy to build LLM applications with chains, agents, and tools. But in production, a simple problem emerges: **how do you ensure LLM outputs actually meet your requirements?**

That's what the **Mellea-LangChain integration** does. Mellea is a generative programming framework that adds automatic validation, structured requirements, and intelligent retry logic to your LangChain workflows.

## Core Pattern: Instruct-Validate-Repair

Mellea adds **generative programming patterns** that treat LLM generation as a structured programming problem:

### Automatic Validation and Retry

```python
from mellea import start_session
from mellea_langchain import MelleaChatModel
from mellea.stdlib.requirements import req
from mellea.stdlib.sampling import RejectionSamplingStrategy
from langchain_core.messages import HumanMessage

# Create Mellea-powered LangChain model
m = start_session()
chat_model = MelleaChatModel(mellea_session=m)

# Define explicit requirements
response = chat_model.invoke(
    [HumanMessage(content="Write a formal business email")],
    model_options={
        "requirements": [
            req("Must include a professional greeting"),
            req("Must be concise (under 200 words)"),
            req("Must include a clear call to action"),
        ],
        "strategy": RejectionSamplingStrategy(loop_budget=5),
        "return_sampling_results": True,
    }
)

# Mellea automatically validates and retries until requirements are met
print(f"Content: {response.content}")
```

Here's what happens:

1. Generates an output
2. Validates it against your requirements using LLM-as-a-judge
3. If validation fails, automatically retries with feedback
4. Returns the first valid output or the best attempt within the loop budget

LangChain generates once and returns whatever it gets. Mellea keeps trying until the output is valid.

### Sampling Strategies for Inference-Time Scaling

You can choose how aggressive the retry logic is. Each strategy trades more API calls for better output quality. Pass the strategy along with requirements in `model_options`:

```python
from mellea.stdlib.sampling import (
    RejectionSamplingStrategy,
    MultiTurnStrategy,
    RepairTemplateStrategy
)
from mellea.stdlib.requirements import req

# Rejection Sampling: Keep trying until requirements are met (up to loop_budget)
# Cost: Up to N LLM calls + N validation calls
response = chat_model.invoke(
    messages,
    model_options={
        "requirements": [req("Must be professional")],
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)

# Multi-Turn Strategy: Agentic multi-turn repair with conversation
# Cost: Multiple LLM calls with conversational context
response = chat_model.invoke(
    messages,
    model_options={
        "requirements": [req("Must be professional")],
        "strategy": MultiTurnStrategy(loop_budget=3),
    }
)

# Repair Template Strategy: Adds repair instructions to failed attempts
# Cost: Up to N LLM calls with repair context
response = chat_model.invoke(
    messages,
    model_options={
        "requirements": [req("Must be professional")],
        "strategy": RepairTemplateStrategy(loop_budget=3),
    }
)
```

Each strategy uses more inference to improve quality. LangChain doesn't have a built-in equivalent. The tradeoff: more API calls and latency for better output.

### Requirements as Composable Objects

Requirements in Mellea are structured and reusable, not scattered in prompt text:

```python
from mellea.stdlib.requirements import req, check, simple_validate
from langchain_core.messages import HumanMessage

# LLM-validated requirements (semantic, slower but flexible)
semantic_requirements = [
    req("The email should be professional"),
    req("The tone should be friendly but formal"),
    check("Do not mention pricing"),
]

# Deterministic requirements (fast, no LLM call needed)
deterministic_requirements = [
    req("Under 200 words", validation_fn=simple_validate(lambda x: len(x.split()) < 200)),
    req("Must include email address", validation_fn=simple_validate(lambda x: "@" in x)),
    req("Must start with 'Dear'", validation_fn=simple_validate(lambda x: x.startswith("Dear"))),
]

# Combine both types for comprehensive validation
all_requirements = semantic_requirements + deterministic_requirements

# Generate with validation
response = chat_model.invoke(
    [HumanMessage(content="Write a business email to the sales team about a product launch. Include a contact email.")],
    model_options={
        "requirements": all_requirements,
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)
```

You get both speed (deterministic checks < 1ms) and flexibility (LLM-based semantic validation).

## What This Integration Enables

### Guaranteed Output Quality

Most LangChain chains generate once and return whatever they get. With Mellea, the output keeps being regenerated until it meets your requirements:

```python
from langchain_core.prompts import ChatPromptTemplate

# Standard LangChain (no validation)
standard_chain = prompt | standard_langchain_model
result = standard_chain.invoke({"topic": "AI"})
# May or may not meet your requirements

# With Mellea (validated)
mellea_chain = prompt | chat_model
result = mellea_chain.invoke(
    {"topic": "AI"},
    model_options={
        "requirements": [
            req("Must be well-structured with clear sections"),
            req("Must include specific examples"),
            req("Must be between 300-500 words",
                validation_fn=simple_validate(lambda x: 300 <= len(x.split()) <= 500)),
        ],
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)
# Meets requirements or returns the best attempt with validation feedback
```

The cost: up to 5x latency and higher API usage. Use when quality beats speed.

### Reusable Requirements

Instead of validation logic scattered across your code, define requirements once and reuse them:

```python
# Define reusable requirement sets
professional_email_requirements = [
    req("Must have a professional greeting"),
    req("Must be formal in tone"),
    req("Must include a clear subject line"),
]

concise_requirements = [
    req("Under 200 words", validation_fn=simple_validate(lambda x: len(x.split()) < 200)),
    req("At least 50 words", validation_fn=simple_validate(lambda x: len(x.split()) > 50)),
]

# Compose them
email_requirements = professional_email_requirements + concise_requirements

# Use across multiple chains with strategy
customer_email_chain = prompt1 | chat_model
result1 = customer_email_chain.invoke(
    {"customer": "John", "issue": "billing"},
    model_options={
        "requirements": email_requirements,
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)

internal_email_chain = prompt2 | chat_model
result2 = internal_email_chain.invoke(
    {"topic": "quarterly review"},
    model_options={
        "requirements": email_requirements,
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)
```

### Validation Transparency

When validation fails, see why it failed and how many attempts were made:

```python
response = chat_model.invoke(
    [HumanMessage(content="Write a brief statement about technology")],
    model_options={
        "requirements": [
            req("Must be exactly 3 sentences"),
            req("Must mention 'quantum computing'"),
            req("Must be under 50 words", validation_fn=simple_validate(lambda x: len(x.split()) < 50)),
        ],
        "strategy": RejectionSamplingStrategy(loop_budget=5),
        "return_sampling_results": True,
    }
)

# During generation, you'll see detailed feedback:
# 0%|          | 0/5 [00:00<?, ?it/s] FAILED. Valid: 2/3. Failed:
#     - Must be exactly 3 sentences
# 20%|██        | 1/5 [00:00<00:03,  1.10it/s] FAILED. Valid: 2/3. Failed:
#     - Must be exactly 3 sentences
# ...
# After 5 attempts, it selects the best result

# The response is a standard LangChain AIMessage
print(f"Content: {response.content}")
```

This transparency shows:
- Progress bar indicating validation attempts (0-100%)
- Which specific requirements failed at each attempt
- How many requirements passed vs. failed
- When the best attempt is selected after exhausting retries

### Generative Functions

Mellea's `@generative` decorator defines AI-generated functions without implementation. While this feature works with Mellea directly, it's not yet integrated into the LangChain wrapper, but it demonstrates a powerful pattern:

```python
from mellea import start_session, generative
from typing import Literal

# Create session
m = start_session()

# Define a generative function - no implementation needed!
@generative
def classify_sentiment(text: str) -> Literal["positive", "negative", "neutral"]:
    """Classify the sentiment of the input text."""

# Use it like a regular function
sentiment = classify_sentiment(m, text="I love this product!")
print(sentiment)  # Output: positive

# Another example
@generative
def categorize_email(subject: str, body: str) -> Literal["urgent", "normal", "spam"]:
    """Categorize an email based on its subject and body."""

category = categorize_email(m,
    subject="URGENT: Server Down",
    body="Our production server is down."
)
print(category)  # Output: urgent
```

Instead of writing a classifier, you declare what it should do (via the function signature and docstring) and let Mellea generate the behavior. The type hints constrain the output to valid values.

## Real-World Patterns

### Validated Output Parsing

Most LangChain chains parse without validation. Add Mellea validation before parsing to catch format issues early:

```python
chain = prompt | chat_model

result = chain.invoke(
    input,
    model_options={
        "requirements": [req("Must be valid JSON"), req("Must include all fields")],
        "strategy": RejectionSamplingStrategy(loop_budget=3),
    }
)
# Now parse the validated output
parsed = output_parser.parse(result.content)
```

### Validated Tool Calls

Agents often produce malformed tool calls. Validate them before execution:

```python
# Agent outputs are validated
mellea_model = MelleaChatModel(
    mellea_session=m,
    requirements=[
        req("Tool calls must be properly formatted"),
        req("Must provide reasoning for tool selection"),
    ]
)
agent = create_tool_calling_agent(llm=mellea_model, tools=tools)
result = agent_executor.invoke({"input": query})
```

### Validation + Parsing

Combine semantic validation with deterministic parsing:

```python
# Validate before parsing
import json

# Define validation functions
def is_json(text: str) -> bool:
    """Must be JSON."""
    try:
        json.loads(text)
        return True
    except:
        return text.strip().startswith("{")

def has_name_field(text: str) -> bool:
    """Must include 'name' field."""
    return "name" in text.lower()

# Create chain with semantic validation during generation
chain = prompt | chat_model

result = chain.invoke(
    input,
    model_options={
        "requirements": [req("Must output valid JSON")],
        "strategy": RejectionSamplingStrategy(loop_budget=3),
    }
)

# Deterministic post-validation
if is_json(result.content) and has_name_field(result.content):
    parsed = json.loads(result.content)
    # Use parsed data
else:
    # Handle validation failure
    pass
```

## Example: Customer Support Email

Without Mellea, you retry manually when the output fails checks:

```python
chain = prompt | model
email = chain.invoke({"customer": "John", "issue": "billing"})

if len(email.split()) > 300:
    email = chain.invoke({"customer": "John", "issue": "billing", "length": "short"})
if "Dear" not in email:
    email = chain.invoke({"customer": "John", "issue": "billing", "greeting": "required"})
# Still might not meet all requirements
```

With Mellea, define what you need and let it retry automatically:

```python
chain = prompt | chat_model

email = chain.invoke(
    {"customer": "John", "issue": "billing"},
    model_options={
        "requirements": [
            req("Must have a professional greeting"),
            req("Must address the specific issue"),
            req("Must be empathetic and helpful"),
            req("Under 300 words", validation_fn=simple_validate(lambda x: len(x.split()) < 300)),
            req("Must include greeting", validation_fn=simple_validate(lambda x: "Dear" in x)),
        ],
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)
# Retried up to 5 times automatically
```

## Feature Comparison

| Feature | LangChain | Mellea |
| --- | --- | --- |
| Output Validation | Manual, external | Automatic, built-in |
| Retry Logic | You write it | Sampling strategies included |
| Requirements | In prompts | Reusable Python objects |
| Validation Feedback | None | Detailed results per attempt |
| Inference-Time Scaling | No | Rejection, MultiTurn, Repair strategies |
| Generative Functions | No | `@generative` decorator |
| Semantic Validation | No | LLM-as-a-judge |
| Fast Checks | No | `simple_validate()` with no LLM calls |

## Mellea vs. LangChain's Native Guardrails

LangChain has its own guardrails system for output validation. They work differently from Mellea.

### LangChain Guardrails

LangChain's guardrails validate output after generation, using external services and rules:

Example:

```python
# LangChain native guardrails (conceptual example)
from langchain.guardrails import GuardrailsRunnable
from langchain_core.prompts import ChatPromptTemplate

# Define guardrails using external service
guardrails = GuardrailsRunnable.from_rail_string("""
<rail version="0.1">
<output>
    <string name="response"
            validators="length: 0 500"
            on-fail-length="reask"/>
</output>
</rail>
""")

# Chain with post-generation validation
chain = prompt | model | guardrails
result = chain.invoke({"input": "..."})
```

### How Mellea Differs

Instead of validating after generation, Mellea validates during generation and retries if needed:

| Aspect | LangChain Guardrails | Mellea |
| --- | --- | --- |
| Philosophy | Validate after generation | Validate during; retry if needed |
| Timing | After generation only | During generation with automatic retry |
| Validation | External services + rules | LLM or deterministic checks |
| Retry | You write it | Built-in strategies |
| Requirements | Configuration DSL | Python objects |
| Reusability | Limited | Composable with `&` |
| Semantic Validation | Requires external API | Built-in |
| Fast Checks | Rules only | `simple_validate()` functions |
| **Integration** | Separate component | Integrated into model generation |

### Key Differences Explained

#### Validation Timing and Retry

LangChain generates, then validates. You handle retries manually:

```python
chain = prompt | model | guardrails
try:
    result = chain.invoke(input)
except ValidationError:
    result = chain.invoke(input)  # Manual retry
```

Mellea validates and retries automatically during generation:

```python
chain = prompt | chat_model
result = chain.invoke(
    input,
    model_options={
        "requirements": [req("Must be professional")],
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)  # Retries up to 5 times automatically
```

Tradeoff: Mellea is slower but guarantees the output meets requirements. LangChain is faster but requires manual retry logic.

#### Semantic vs. Rule-Based Validation

LangChain uses rules and external services:

```python
guardrails = GuardrailsRunnable(
    validators=[
        LengthValidator(min=50, max=500),
        RegexValidator(pattern=r"^Dear.*"),
        ToxicityValidator(threshold=0.8),
    ]
)
```

Mellea mixes semantic (LLM-based) with deterministic checks:

```python
requirements = [
    req("Must be professional and empathetic"),
    req("Must address the concern"),
    req("Under 500 words", validation_fn=simple_validate(lambda x: len(x.split()) < 500)),
    req("Starts with greeting", validation_fn=simple_validate(lambda x: x.startswith("Dear"))),
]
```

Tradeoff: LangChain's rules are fast but limited. Mellea's semantic checks are powerful but cost extra API calls.

#### Composability and Reusability

LangChain guardrails are typically per-chain:

```python
chain1 = prompt1 | model | guardrails1
chain2 = prompt2 | model | guardrails2
```

Mellea requirements are reusable Python lists:

```python
professional_reqs = [req("Professional tone"), req("Clear structure")]
length_reqs = [req("50-500 words", validation_fn=simple_validate(lambda x: 50 < len(x.split()) < 500))]

email_chain = prompt1 | chat_model
email_result = email_chain.invoke(
    input,
    model_options={"requirements": professional_reqs + length_reqs}
)

report_chain = prompt2 | chat_model
report_result = report_chain.invoke(
    input,
    model_options={"requirements": professional_reqs + length_reqs}
)
```

You can also compose guardrails with the `&` operator:

```python
# MelleaGuardrail expects callable functions
def is_professional(text: str) -> bool:
    """Check if text is professional."""
    return len(text) > 20

def is_proper_length(text: str) -> bool:
    """Check if text is 50-500 words."""
    return 50 < len(text.split()) < 500

guardrail1 = MelleaGuardrail(requirements=[is_professional], name="professional")
guardrail2 = MelleaGuardrail(requirements=[is_proper_length], name="length")
combined = guardrail1 & guardrail2
```

Tradeoff: Mellea requires more setup but pays off with reuse and maintainability.

#### Validation Feedback

LangChain gives generic error messages:

```python
try:
    result = chain.invoke(input)
except ValidationError as e:
    print(e)  # Generic message, no details on what failed
```

Mellea provides detailed results per attempt:

```python
result = guardrail.validate(text)
print(f"Passed: {result.passed}")
print(f"Failed requirements: {result.errors}")
print(f"Metadata: {result.metadata}")
# Output: Failed requirements: ['Must be professional and empathetic']
```

Tradeoff: Mellea gives more details, so you get better insight into what went wrong.

### When to Use Each

Use **LangChain guardrails** if you need:

- PII/toxicity detection from established services
- Existing guardrail infrastructure (Guardrails AI, NeMo)
- Simple rule-based validation only
- Minimal latency overhead
- JavaScript/TypeScript support

Use **Mellea** if you need:

- Semantic validation (tone, intent, meaning)
- Automatic retry without manual intervention
- Quality over speed (can afford 2-5x latency)
- Reusable validation logic
- Inference-time scaling (compute for quality tradeoff)
- Python applications with better ergonomics

### Using Both Together

Combine both for comprehensive validation:

```python
from mellea import start_session
from mellea_langchain import MelleaChatModel, MelleaGuardrail
from mellea.stdlib.requirements import req
from mellea.stdlib.sampling import RejectionSamplingStrategy

# Create Mellea model with semantic validation during generation
m = start_session()
chat_model = MelleaChatModel(mellea_session=m)

# Define deterministic post-generation checks (MelleaGuardrail expects callables)
def under_500_words(text: str) -> bool:
    """Under 500 words."""
    return len(text.split()) < 500

def no_email_addresses(text: str) -> bool:
    """No email addresses."""
    return "@" not in text

def no_sensitive_data(text: str) -> bool:
    """No sensitive data."""
    return not any(word in text.lower() for word in ["password", "ssn"])

post_guardrail = MelleaGuardrail(
    requirements=[under_500_words, no_email_addresses, no_sensitive_data],
    name="post_generation_check"
)

# Use in chain
chain = prompt | chat_model

# Generate with semantic validation
result = chain.invoke(
    {"input": "..."},
    model_options={
        "requirements": [
            req("Must be professional and helpful"),
            req("Must address the customer's specific issue"),
        ],
        "strategy": RejectionSamplingStrategy(loop_budget=3),
    }
)

# Apply deterministic post-checks
validation = post_guardrail.validate(result.content)
if not validation.passed:
    print(f"Post-validation failed: {validation.errors}")
    # Handle failure
```

This gives you semantic validation during generation + fast deterministic checks after, plus automatic retry and clear separation of concerns.

### Full Example: Customer Support Email

Generate a professional email that addresses the customer's issue and meets length requirements.

**Without Mellea (LangChain):**

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

# Standard generation
model = ChatOpenAI()
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a customer support agent. Write professional emails."),
    ("human", "Customer issue: {issue}")
])

chain = prompt | model

# Manual validation and retry
max_attempts = 5
for attempt in range(max_attempts):
    result = chain.invoke({"issue": "billing problem"})
    
    # Manual validation
    word_count = len(result.content.split())
    is_professional = "Dear" in result.content
    
    if 50 < word_count < 300 and is_professional:
        break  # Success
    # Otherwise, try again
else:
    # Failed after max attempts
    print("Could not generate valid email")
```

**With Mellea:**

```python
from mellea import start_session
from mellea_langchain import MelleaChatModel
from mellea.stdlib.requirements import req, simple_validate
from mellea.stdlib.sampling import RejectionSamplingStrategy
from langchain_core.prompts import ChatPromptTemplate

# Create Mellea-powered model
m = start_session()
chat_model = MelleaChatModel(mellea_session=m)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a customer support agent. Write professional emails."),
    ("human", "Customer issue: {issue}")
])

# Automatic validation and retry
chain = prompt | chat_model

# Single call with automatic validation and retry
result = chain.invoke(
    {"issue": "billing problem"},
    model_options={
        "requirements": [
            req("Must be professional and empathetic"),
            req("Must directly address the billing issue"),
            req("Must include a clear next step"),
            req("50-300 words", validation_fn=simple_validate(lambda x: 50 < len(x.split()) < 300)),
            req("Starts with greeting", validation_fn=simple_validate(lambda x: x.startswith("Dear"))),
        ],
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)
# Guaranteed to meet requirements or returns best attempt with feedback
```

The difference:

- LangChain uses ~15 lines of manual retry logic. Mellea uses ~10 lines with built-in retries.
- LangChain validates with rules. Mellea uses semantic validation (the LLM judges quality).
- LangChain validation is scattered. Mellea validation is centralized.
- LangChain gives generic errors. Mellea gives detailed results per attempt.

In short: LangChain guardrails filter bad outputs after they're generated. Mellea guardrails generate correct outputs from the start.

## When to Use This Integration

**Good for:**

- Production apps where quality matters more than speed
- Structured content (emails, reports, docs with format requirements)
- Compliance-sensitive work (regulatory or business constraints)
- Multi-backend dev (Ollama locally, OpenAI in prod)
- Complex validation (semantic + deterministic checks)

**Not ideal for:**

- Real-time chat (sub-second latency required)
- Simple Q&A (validation overhead not justified)
- Cost-sensitive apps with frontier models (GPT-4, Claude API costs add up). Note: Mellea with Small Language Models (SLMs) has lower costs.
- Streaming responses (current integration returns full response as one chunk)

## Limitations

- **No streaming** — `stream()` and `astream()` return the full response as one chunk
- **Latency** — Validation and retry add 2-5x overhead to base latency
- **Cost** — Each validation attempt consumes API credits
- **LLM-as-judge** — Semantic validation quality depends on your validator model

Key tradeoffs:

- Quality vs. Speed: more validation = slower
- Cost vs. Reliability: more retries = higher API costs
- Complexity vs. Simplicity: structured requirements need more code but are easier to maintain

## Getting Started

### Installation

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

## How It Works

```text
Your LangChain Application
    ↓
MelleaChatModel (LangChain interface)
    ↓
Mellea's Generative Programming Layer
  ├─ Instruct-Validate-Repair Loop (generate → validate → retry)
  ├─ Sampling Strategies (Rejection, MultiTurn, RepairTemplate)
  └─ Requirements System (semantic + deterministic validation)
    ↓
Mellea Backends (Ollama, OpenAI, WatsonX, HuggingFace, etc.)
```

## Summary

- Mellea treats LLM outputs as programs: give them explicit requirements and validation.
- The instruct-validate-repair pattern keeps trying until outputs are valid.
- Requirements are composable Python objects, not scattered in prompts.
- Sampling strategies let you trade compute for quality.
- Mellea works with LangChain, not instead of it.
- Tradeoff: higher latency and API costs for better quality.

## Next Steps

Run the examples:

```bash
cd mellea-contribs/mellea_contribs/langchain_backend/examples
python requirements_strategy_example.py
```

Read more:

- [Mellea Documentation](https://docs.mellea.ai/)
- [Integration Examples](https://github.com/generative-computing/mellea-contribs/tree/main/mellea_contribs/langchain_backend/examples)
- [LangChain Docs](https://python.langchain.com/)
- [Mellea Discord Community](https://ibm.biz/mellea-discord)

---

This integration is part of [mellea-contribs](https://github.com/generative-computing/mellea-contribs), an incubation point for Mellea ecosystem contributions.

---
title: "What Mellea Brings to LangChain: Structured Generative Programming for Reliable AI Applications"
date: "2026-04-27"
author: "Akihiko Kuroda"
excerpt: "Learn how Mellea's generative programming patterns add structured validation, automatic retry, and inference-time scaling to LangChain applications."
tags: ["langchain", "mellea", "generative-programming", "llm", "validation", "reliability"]
---

LangChain has revolutionized how developers build LLM applications, providing a rich ecosystem of chains, agents, and tools. But as applications move to production, developers face a critical challenge: **how do you ensure LLM outputs are reliable, consistent, and meet specific requirements?**

This is where **Mellea** comes in. Mellea is a generative programming framework that replaces flaky agents and brittle prompts with structured, maintainable, and robust AI workflows. The new **Mellea-LangChain integration** brings Mellea's unique capabilities directly into your LangChain applications.

## What Makes Mellea Different?

While LangChain excels at orchestrating LLM interactions, Mellea introduces **generative programming patterns** that fundamentally change how you think about LLM reliability:

### 1. **Instruct-Validate-Repair Pattern**

Mellea's core innovation is treating LLM generation as a structured programming problem with explicit requirements and validation:

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

**What's happening here?** Unlike traditional LangChain models that generate once and hope for the best, Mellea:

1. Generates an output
2. Validates it against your requirements using LLM-as-a-judge
3. If validation fails, automatically retries with feedback
4. Returns the first valid output or the best attempt within the loop budget

Standard LangChain doesn't include this—it's unique to Mellea.

### 2. **Sampling Strategies for Inference-Time Scaling**

Mellea provides sophisticated sampling strategies that go beyond simple retry logic. These strategies trade additional inference-time compute for improved output quality:

```python
from mellea.stdlib.sampling import (
    RejectionSamplingStrategy,
    MultiTurnStrategy,
    RepairTemplateStrategy
)

# Rejection Sampling: Keep trying until requirements are met (up to loop_budget)
# Cost: Up to N LLM calls + N validation calls
rejection_model = chat_model.bind(
    model_options={
        "strategy": RejectionSamplingStrategy(loop_budget=5)
    }
)

# Multi-Turn Strategy: Agentic multi-turn repair with conversation
# Cost: Multiple LLM calls with conversational context
multi_turn_model = chat_model.bind(
    model_options={
        "strategy": MultiTurnStrategy(loop_budget=3)
    }
)

# Repair Template Strategy: Adds repair instructions to failed attempts
# Cost: Up to N LLM calls with repair context
repair_model = chat_model.bind(
    model_options={
        "strategy": RepairTemplateStrategy(loop_budget=3)
    }
)
```

These strategies enable **inference-time scaling**—improving output quality by using more compute at generation time. LangChain doesn't provide this natively. In exchange for better quality, you pay extra latency and API costs proportional to the number of attempts.

### 3. **Requirements as First-Class Citizens**

In Mellea, requirements aren't just prompts - they're structured, composable, and verifiable:

```python
from mellea.stdlib.requirements import req, check, simple_validate

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

# Use in LangChain chain with strategy to validate requirements
chain = prompt | chat_model.bind(
    model_options={
        "requirements": all_requirements,
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)
```

**Key insight:** Mellea lets you mix fast deterministic checks (< 1ms) with powerful LLM-based semantic validation, giving you both speed and flexibility.

## Mellea's Unique Functions in LangChain

### Function 1: Guaranteed Output Quality with Validation

Standard LangChain models generate once—no retry if the output misses your requirements. Mellea adds built-in validation with automatic retry:

```python
from langchain_core.prompts import ChatPromptTemplate

# Standard LangChain (no validation)
standard_chain = prompt | standard_langchain_model
result = standard_chain.invoke({"topic": "AI"})
# May or may not meet your requirements

# With Mellea (validated)
mellea_chain = prompt | chat_model.bind(
    model_options={
        "requirements": [
            req("Must be well-structured with clear sections"),
            req("Must include specific examples"),
            req("Must be between 300-500 words"),
        ],
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)
result = mellea_chain.invoke({"topic": "AI"})
# Meets requirements or returns the best attempt with validation feedback
```

**Tradeoff:** This approach increases latency (potentially 5x if all retries are needed) and API costs. Use when output quality is more important than response time.

### Function 2: Composable Validation Logic

Validation logic scattered across code is hard to reuse and test. Mellea lets you compose and reuse requirements:

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
customer_email_chain = prompt1 | chat_model.bind(
    model_options={
        "requirements": email_requirements,
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)
internal_email_chain = prompt2 | chat_model.bind(
    model_options={
        "requirements": email_requirements,
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)
```

### Function 3: Transparent Validation Results

When validation fails, you want to know why and how many retries were attempted. Mellea provides detailed sampling results:

```python
response = chat_model.invoke(
    messages,
    model_options={
        "requirements": requirements,
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)

# The response is a standard LangChain AIMessage
# Validation happens automatically behind the scenes
print(f"Content: {response.content}")

# Note: In the LangChain integration, sampling results are handled internally
# The model will retry up to loop_budget times to meet requirements
```

### Function 4: Generative Functions

Mellea's `@generative` decorator (not yet exposed in this LangChain integration) defines AI-generated functions without implementation:

```python
from mellea import generative
from typing import Literal

@generative
def classify_sentiment(text: str) -> Literal["positive", "negative", "neutral"]:
    """Classify the sentiment of the input text."""

# Use in your LangChain workflow
sentiment = classify_sentiment(m, text=user_input)
if sentiment == "positive":
    # Route to positive response chain
    response = positive_chain.invoke({"input": user_input})
```

This approach—defining functions without implementing them—is unique to Mellea.

## How Mellea Enhances LangChain Patterns

### Enhanced Chain Reliability

Standard LangChain generates text without guarantees. Mellea adds validation before parsing:

```python
chain = (
    prompt 
    | chat_model.bind(
        model_options={
            "requirements": [req("Must be valid JSON"), req("Must include all fields")],
            "strategy": RejectionSamplingStrategy(loop_budget=3),
        }
    )
    | output_parser
)
result = chain.invoke(input)  # Validated before parsing!
```

### Enhanced Agent Reliability

Agents can produce invalid tool calls. Mellea validates them before execution:

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

### Enhanced Output Parsing

Parsers fail on invalid output. Validate before parsing with Mellea:

```python
# Validate before parsing
from mellea_langchain import MelleaOutputParser

# Define validation functions (MelleaOutputParser uses simple callables)
def is_json(text: str) -> bool:
    """Must be JSON."""
    return text.strip().startswith("{")

def has_name_field(text: str) -> bool:
    """Must include 'name' field."""
    return "name" in text

parser = MelleaOutputParser(
    requirements=[is_json, has_name_field]
)
chain = (
    prompt 
    | chat_model.bind(
        model_options={
            "requirements": [req("Must output valid JSON")],
            "strategy": RejectionSamplingStrategy(loop_budget=3),
        }
    )
    | parser
)
result = chain.invoke(input)  # Double validation: generation + parsing
```

## Real-World Example: Customer Support Email

Without Mellea, you manually validate and retry:

```python
# Generate email
chain = prompt | model
email = chain.invoke({"customer": "John", "issue": "billing"})

# Manual validation
if len(email.split()) > 300:
    email = chain.invoke({"customer": "John", "issue": "billing", "length": "short"})

if "Dear" not in email:
    email = chain.invoke({"customer": "John", "issue": "billing", "greeting": "required"})

# Still might not meet all requirements!
```

With Mellea:

```python
chain = prompt | chat_model.bind(
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

email = chain.invoke({"customer": "John", "issue": "billing"})
# Meets all requirements, or returns feedback on what failed
```

## What Mellea Adds That LangChain Doesn't Have

| Feature | LangChain Alone | With Mellea |
| --- | --- | --- |
| **Output Validation** | Manual, external | Built-in, automatic |
| **Retry Logic** | Manual implementation | Sophisticated sampling strategies |
| **Requirements** | Embedded in prompts | First-class, composable objects |
| **Validation Feedback** | None | Detailed results and reasoning |
| **Inference-Time Scaling** | Not supported | Multiple strategies (Rejection, MultiTurn, Repair) |
| **Generative Programming** | Not available | `@generative` decorator for function synthesis |
| **Semantic Validation** | Not available | LLM-as-a-judge built-in |
| **Deterministic Checks** | Manual | `simple_validate()` for fast checks |

## Mellea vs. LangChain's Native Guardrails

LangChain provides its own guardrails system (documented at [LangChain Guardrails](https://docs.langchain.com/oss/javascript/langchain/guardrails)), which offers a different approach to output validation. Understanding the differences helps you choose the right tool for your needs.

### What Are LangChain's Native Guardrails?

LangChain's guardrails are primarily **post-generation validation** using external services and rule-based checks:

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

### How Mellea's Approach Differs

Mellea takes a different approach:

| Aspect | LangChain Native Guardrails | Mellea Guardrails |
| --- | --- | --- |
| **Philosophy** | Post-generation validation | Instruct-validate-repair loop |
| **Validation Timing** | After generation only | During generation with automatic retry |
| **Validation Method** | External services + rules | LLM-as-a-judge + deterministic checks |
| **Retry Logic** | Manual implementation | Built-in sampling strategies |
| **Requirements** | Configuration strings/DSL | First-class Python objects |
| **Composability** | Limited | Highly composable with `&` operator |
| **Semantic Validation** | Requires external service | Built-in with LLM-as-a-judge |
| **Deterministic Checks** | Rule-based only | Fast `simple_validate()` functions |
| **Integration** | Separate component | Integrated into model generation |

### Key Differences Explained

#### 1. **Validation Timing and Retry**

**LangChain Native:**

```python
# Generate once, validate after, manually retry if needed
chain = prompt | model | guardrails
try:
    result = chain.invoke(input)
except ValidationError:
    # Manual retry logic
    result = chain.invoke(input)  # Try again
```

**Mellea:**

```python
# Automatic validation and retry during generation
chain = prompt | chat_model.bind(
    model_options={
        "requirements": [req("Must be professional")],
        "strategy": RejectionSamplingStrategy(loop_budget=5),
    }
)
result = chain.invoke(input)  # Automatically retries up to 5 times
```

**Tradeoff**: Mellea adds latency but guarantees quality. LangChain is faster but requires manual retry logic.

#### 2. **Semantic vs. Rule-Based Validation**

**LangChain Native:**

```python
# Primarily rule-based or external service
guardrails = GuardrailsRunnable(
    validators=[
        LengthValidator(min=50, max=500),
        RegexValidator(pattern=r"^Dear.*"),
        ToxicityValidator(threshold=0.8),  # External API
    ]
)
```

**Mellea:**

```python
# Mix semantic (LLM-based) and deterministic validation
requirements = [
    # Semantic validation (flexible, understands context)
    req("Must be professional and empathetic"),
    req("Must address the customer's concern"),
    
    # Deterministic validation (fast, no LLM call)
    req("Under 500 words", validation_fn=simple_validate(lambda x: len(x.split()) < 500)),
    req("Starts with greeting", validation_fn=simple_validate(lambda x: x.startswith("Dear"))),
]
```

**Tradeoff**: LangChain's rules are faster but less flexible. Mellea's semantic validation is more powerful but costs extra LLM calls.

#### 3. **Composability and Reusability**

**LangChain Native:**

```python
# Guardrails are typically configured per-chain
chain1 = prompt1 | model | guardrails1
chain2 = prompt2 | model | guardrails2
# Composition is limited
```

**Mellea:**

```python
# Requirements are composable Python objects
professional_reqs = [req("Professional tone"), req("Clear structure")]
length_reqs = [req("50-500 words", validation_fn=simple_validate(lambda x: 50 < len(x.split()) < 500))]

# Reuse across chains
email_chain = prompt1 | chat_model.bind(model_options={"requirements": professional_reqs + length_reqs})
report_chain = prompt2 | chat_model.bind(model_options={"requirements": professional_reqs + length_reqs})

# Or compose guardrails
guardrail1 = MelleaGuardrail(requirements=professional_reqs, name="professional")
guardrail2 = MelleaGuardrail(requirements=length_reqs, name="length")
combined = guardrail1 & guardrail2  # Compose with & operator
```

**Tradeoff**: Mellea takes more setup but enables reuse and easier maintenance.

#### 4. **Validation Feedback and Transparency**

**LangChain Native:**

```python
# Limited feedback on validation failures
try:
    result = chain.invoke(input)
except ValidationError as e:
    print(e)  # Generic error message
    # No details on which validators failed or why
```

**Mellea:**

```python
# Detailed validation results
result = guardrail.validate(text)
print(f"Passed: {result.passed}")
print(f"Failed requirements: {result.errors}")
print(f"Metadata: {result.metadata}")
# Output:
# Passed: False
# Failed requirements: ['Must be professional and empathetic']
# Metadata: {'guardrail_name': 'email_check', 'total_requirements': 3,
#            'passed_requirements': 2, 'failed_requirements': 1}
```

**Tradeoff**: Mellea gives you more details but you need to handle them.

### When to Use Each Approach

#### ✅ **Use LangChain's Native Guardrails When:**

1. **You need specialized content moderation** - PII detection, toxicity filtering, bias detection from established services
2. **You have existing guardrail infrastructure** - Already using Guardrails AI, NeMo, or similar services
3. **Simple rule-based validation is sufficient** - Length checks, regex patterns, format validation
4. **You want minimal latency overhead** - Post-generation validation with no retry logic
5. **You're working with JavaScript/TypeScript** - LangChain's guardrails have better JS support

#### ✅ **Use Mellea's Guardrails When:**

1. **You need semantic validation** - Understanding context, tone, intent, or meaning
2. **Automatic retry is important** - You want the system to fix issues without manual intervention
3. **Quality is more important than speed** - You can afford 2-5x latency for better outputs
4. **You need composable validation logic** - Building complex validation from reusable components
5. **You want inference-time scaling** - Trading compute for quality with sophisticated sampling strategies
6. **You're building production Python applications** - Mellea's Python-first design provides better ergonomics

### Combining Both Approaches

You can use both systems together for comprehensive validation:

```python
from mellea import start_session
from mellea_langchain import MelleaChatModel, MelleaGuardrail
from mellea.stdlib.requirements import req, simple_validate

# Create Mellea model with semantic validation during generation
m = start_session()
chat_model = MelleaChatModel(
    mellea_session=m,
    requirements=[
        req("Must be professional and helpful"),
        req("Must address the customer's specific issue"),
    ]
)

# Add deterministic post-generation checks
post_guardrail = MelleaGuardrail(
    requirements=[
        simple_validate(lambda x: len(x.split()) < 500, "Under 500 words"),
        simple_validate(lambda x: "@" not in x, "No email addresses"),
        simple_validate(lambda x: not any(word in x.lower() for word in ["password", "ssn"]), "No sensitive data"),
    ],
    name="post_generation_check"
)

# Use in chain
chain = prompt | chat_model

# Generate with semantic validation
result = chain.invoke({"input": "..."})

# Apply deterministic post-checks
validation = post_guardrail.validate(result.content)
if not validation.passed:
    print(f"Post-validation failed: {validation.errors}")
    # Handle failure
```

**This hybrid approach gives you:**

- Semantic validation during generation (Mellea's strength)
- Fast deterministic checks after generation (efficient post-processing)
- Automatic retry for semantic issues
- Clear separation of concerns

### Code Example: Side-by-Side Comparison

**Task**: Generate a customer support email that is professional, addresses the issue, and meets length requirements.

**LangChain Native Approach:**

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

**Mellea Approach:**

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
chain = prompt | chat_model.bind(
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

# Single call with automatic validation and retry
result = chain.invoke({"issue": "billing problem"})
# Guaranteed to meet requirements or returns best attempt with feedback
```

**Key Differences:**

- LangChain: ~15 lines of manual retry logic. Mellea: ~10 lines with automatic retries.
- LangChain: rule-based validation. Mellea: semantic validation using the LLM.
- LangChain: validation scattered across code. Mellea: centralized in requirements.
- LangChain: generic error messages on failure. Mellea: detailed results on each attempt.

### Summary: Choosing Your Approach

Use **LangChain's guardrails** for simple rule-based validation with minimal overhead, especially if you already have guardrail infrastructure.

Use **Mellea's guardrails** for semantic validation, automatic retry, and production reliability where quality beats speed.

Use **both together** for comprehensive validation: semantic checks during generation (Mellea) + fast deterministic checks after generation.

**LangChain's guardrails filter outputs. Mellea's guardrails generate correct outputs from the start.** Both are valuable; they solve different problems.

## When to Use This Integration

### ✅ **Good Use Cases:**

1. **Production applications requiring high reliability** - When output quality is critical and you can afford increased latency
2. **Structured content generation** - Emails, reports, documentation with specific format requirements
3. **Compliance-sensitive applications** - When outputs must meet regulatory or business requirements
4. **Multi-backend development** - When you need to switch between Ollama (dev) and OpenAI (prod)
5. **Complex validation logic** - When you need both semantic and deterministic validation

### ⚠️ **Consider Alternatives When:**

1. **Latency is critical** - Real-time chat applications where sub-second response is required
2. **Simple use cases** - Basic Q&A where validation overhead isn't justified
3. **Cost-sensitive applications with frontier models** - When using paid frontier models (GPT-4, Claude, etc.) where API costs must be minimized, as validation adds LLM calls. Note: If using Small Language Models (SLMs) with Mellea—which is part of our strategy to achieve comparable results to larger models—cost is typically not a concern due to lower inference costs.
4. **Streaming is required** - Current integration doesn't support streaming (returns full response)

## Limitations and Tradeoffs

### Current Limitations

1. **No streaming support** - The `stream()` and `astream()` methods return the full response as a single chunk
2. **Increased latency** - Validation and retry logic adds overhead (potentially 2-5x base latency)
3. **Higher API costs** - Each validation attempt consumes API credits
4. **LLM-as-judge limitations** - Semantic validation quality depends on the validator model's capabilities

### Tradeoffs to Consider

- **Quality vs. Speed**: More validation = better quality but slower responses
- **Cost vs. Reliability**: More retries = higher reliability but increased API costs
- **Complexity vs. Simplicity**: Structured requirements add code complexity but improve maintainability

## Getting Started

### Installation

```bash
pip install mellea mellea-langchain langchain
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

validated_chain = prompt | chat_model.bind(
    model_options={
        "requirements": [
            req("Response must be helpful and accurate"),
            req("Response must be concise"),
        ],
        "strategy": RejectionSamplingStrategy(loop_budget=3),
    }
)

# Use it!
result = validated_chain.invoke({"input": "Explain quantum computing"})
print(result.content)
```

## Architecture: How It Works

```diagram
┌─────────────────────────────────────────────────────────┐
│         Your LangChain Application                      │
│         (Chains, Agents, Tools)                         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│         MelleaChatModel (LangChain Interface)           │
│         • Implements BaseChatModel                      │
│         • Accepts requirements & strategies             │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│         Mellea's Generative Programming Layer           │
│         ┌───────────────────────────────────────────┐   │
│         │  Instruct-Validate-Repair Loop            │   │
│         │  1. Generate output                       │   │
│         │  2. Validate against requirements         │   │
│         │  3. If invalid, retry with feedback       │   │
│         │  4. Return validated output               │   │
│         └───────────────────────────────────────────┘   │
│         ┌───────────────────────────────────────────┐   │
│         │  Sampling Strategies                      │   │
│         │  • RejectionSampling                      │   │
│         │  • MultiTurn                              │   │
│         │  • RepairTemplate                         │   │
│         └───────────────────────────────────────────┘   │
│         ┌───────────────────────────────────────────┐   │
│         │  Requirements System                      │   │
│         │  • LLM-based validation (semantic)        │   │
│         │  • Deterministic validation (fast)        │   │
│         │  • Composable requirements                │   │
│         └───────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│         Mellea Backends                                 │
│         (Ollama, OpenAI, WatsonX, HuggingFace, etc.)    │
└─────────────────────────────────────────────────────────┘
```

## Key Takeaways

- Mellea adds structured generative programming to LangChain: treat outputs as programs with requirements and validation
- The instruct-validate-repair pattern automatically retries until requirements are met
- Requirements are composable and reusable with both LLM-based and deterministic validation
- Sampling strategies enable inference-time scaling—trade compute for quality
- Mellea enhances LangChain without replacing it
- Know the tradeoff: higher latency and API costs for better quality

### Run Examples

```bash
cd mellea-contribs/mellea_contribs/langchain_backend/examples
python requirements_strategy_example.py
```

### Learn More

- [Mellea Documentation](https://docs.mellea.ai/)
- [Integration Examples](https://github.com/generative-computing/mellea-contribs/tree/main/mellea_contribs/langchain_backend/examples)
- [LangChain Docs](https://python.langchain.com/)
- [Mellea Discord Community](https://ibm.biz/mellea-discord)

## Conclusion

The Mellea-LangChain integration adds generative programming patterns to LangChain's ecosystem: structured validation, automatic retry, and inference-time scaling to trade compute for output quality.

LLM outputs are programs that should meet specifications. Mellea makes this explicit through requirements, validation, and automatic repair. LangChain provides the ecosystem.

Together, they let you build reliable, maintainable, production-ready AI applications—with clear tradeoffs on latency and cost.

---

This integration is part of [mellea-contribs](https://github.com/generative-computing/mellea-contribs), an incubation point for Mellea ecosystem contributions.

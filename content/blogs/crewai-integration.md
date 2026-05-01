---
title: "Validate Every CrewAI Agent Output: Automatic Retry with Mellea"
date: "2026-05-04"
author: "Akihiko Kuroda"
excerpt: "Mellea brings structured validation and automatic repair to CrewAI multi-agent systems through the instruct-validate-repair pattern."
tags: ["crewai", "multi-agent", "validation", "integration"]
---

In multi-agent pipelines, one agent returns junk, the next agent takes it as input, and your pipeline silently produces garbage. CrewAI has no built-in validation: it generates once and returns whatever it gets.

**Mellea** adds automatic validation and retry logic directly into your agents, so bad outputs never leave the pipeline.

> **Before you start:** Mellea trades latency and API costs for output quality. Expect 2-5x slower responses due to validation retries, and higher token usage. Streaming is not supported—responses return as a single chunk. This is ideal for batch processing and quality-critical applications, but not for real-time interaction or latency-sensitive systems.

## The Problem

Most CrewAI applications follow this pattern:

```python
from crewai import Agent, Task, Crew

agent = Agent(
    role="Researcher",
    goal="Provide accurate information",
    backstory="You are an expert researcher"
)

task = Task(
    description="Research AI trends",
    agent=agent,
    expected_output="A research summary"
)

crew = Crew(agents=[agent], tasks=[task])
result = crew.kickoff()  # Generates once, returns whatever it gets
```

**CrewAI generates once and returns whatever it gets.** When one agent fails, the next gets bad input. Without consistent validation and feedback, multi-agent workflows fall apart quickly.

You end up writing retry logic like this:

```python
max_attempts = 5
for attempt in range(max_attempts):
    result = crew.kickoff()
    
    # Manual validation checks
    if validates_research(result):
        break
    # Otherwise retry
else:
    print("Failed after max attempts")
```

Each agent needs custom validation logic, and you lose all context about what failed when you retry.

## Installation

First, follow [Mellea's Getting Started guide](https://docs.mellea.ai/getting-started) to set up your environment (including Ollama if running locally).

Then install the CrewAI integration:

```bash
# 1. Initialize project and install core packages
uv init crewai-example && cd crewai-example
uv add mellea crewai

# 2. Install wheel packages from releases
# Check https://github.com/generative-computing/mellea-contribs/releases for the latest versions
# and replace the version numbers below (currently v0.1.0)
uv pip install https://github.com/generative-computing/mellea-contribs/releases/download/mellea-integration-core/v0.1.0/mellea_integration_core-0.1.0-py3-none-any.whl
uv pip install https://github.com/generative-computing/mellea-contribs/releases/download/mellea-crewai/v0.1.0/mellea_crewai-0.1.0-py3-none-any.whl
```

## Your First Validated Crew

```python
from mellea import start_session
from mellea_crewai import MelleaLLM
from mellea.stdlib.requirements import req
from mellea.stdlib.sampling import RejectionSamplingStrategy, MultiTurnStrategy
from crewai import Agent, Task, Crew

# Create Mellea session
m = start_session()  # Uses Ollama by default

# Create validated agent
agent = Agent(
    role="Research Assistant",
    goal="Provide accurate, well-researched information",
    backstory="You are an expert researcher with attention to detail",
    llm=MelleaLLM(
        mellea_session=m,
        requirements=[
            req("Response must be accurate and well-researched"),
            req("Response must be concise (under 300 words)"),
            req("Must include specific examples"),
        ],
        strategy=RejectionSamplingStrategy(loop_budget=3),
    )
)

# Create task
task = Task(
    description="Research the benefits of retrieval-augmented generation (RAG)",
    agent=agent,
    expected_output="A concise, well-researched summary with examples"
)

# Execute
crew = Crew(agents=[agent], tasks=[task])
result = crew.kickoff()
print(result)

# Output example:
# Retrieval-Augmented Generation (RAG) combines document search with LLM generation.
# RAG improves accuracy by 42% vs baseline LLMs on knowledge-intensive tasks.
# Example: Enterprise search engines retrieve relevant documents, then GPT-4
# synthesizes answers. Benefits include reduced hallucination, cited sources,
# and real-time knowledge updates without model retraining.
```

## How Mellea Works

Mellea embeds validation directly into the generation loop using three steps:

1. **Instruct**: Embed requirements in the system prompt so the model tries to meet them upfront
2. **Validate**: After generation, check if the output meets all requirements using LLM or Python checks
3. **Repair**: If validation fails, retry with the failure reason up to a configurable budget

Here's what it looks like in practice:

```text
Attempt 1 → FAIL (Reason: Missing specific data points)
Attempt 2 → FAIL (Reason: Word count too low)
Attempt 3 → PASS (Output meets all requirements)
```

See the [Mellea docs](https://docs.mellea.ai/) for the full instruct-validate-repair pattern.

### How It Compares

Pure CrewAI requires manual retry logic around the crew; with Mellea, validation moves into each agent's LLM config:

| Feature | CrewAI Alone | With Mellea |
| ------- | ------------ | ----------- |
| **Agent Output Validation** | Manual, external | Built-in, automatic |
| **Retry Logic** | Manual implementation | Built-in sampling strategies |
| **Requirements** | Embedded in prompts | First-class, composable objects |
| **Validation Feedback** | None | Detailed results and reasoning |
| **Inference-Time Scaling** | Not supported | Multiple strategies (Rejection, MultiTurn, Repair) |
| **Task Guardrails** | Basic validation | Mellea requirements as guardrails |
| **Agent Specialization** | Same LLM config | Different validation per agent |
| **Semantic Validation** | Not available | LLM-as-a-judge built-in |
| **Deterministic Checks** | Manual | `simple_validate()` for fast checks |
| **Multi-Backend Support** | Limited | Ollama, OpenAI, WatsonX, HuggingFace, etc. |

### Automatic Validation and Retry

```python
from mellea import start_session
from mellea_crewai import MelleaLLM
from mellea.stdlib.requirements import req
from mellea.stdlib.sampling import RejectionSamplingStrategy
from crewai import Agent, Task, Crew

m = start_session()

validated_agent = Agent(
    role="Research Analyst",
    goal="Provide accurate, well-researched analysis",
    backstory="You are a senior analyst with expertise in AI trends.",
    llm=MelleaLLM(
        mellea_session=m,
        requirements=[
            req("Must include specific data points or statistics"),
            req("Must provide clear conclusions"),
        ],
        strategy=RejectionSamplingStrategy(loop_budget=5),
    )
)

task = Task(
    description="Write a brief analysis of recent trends in large language models (around 200 words).",
    agent=validated_agent,
    expected_output="Brief analysis with data and conclusions"
)

crew = Crew(agents=[validated_agent], tasks=[task])
result = crew.kickoff()
print(result)

# Output example:
# Large language models (LLMs) represent one of the most significant AI breakthroughs.
# Key data: GPT-4 achieves 86% accuracy on MMLU, Llama 2 shows 2x faster inference,
# and multimodal models handle images + text. These advances enable production systems
# in healthcare diagnostics, financial analysis, and scientific research.
# Conclusion: The next frontier is efficient inference and specialized domain models.
```

### Sampling Strategies

Different strategies trade compute for quality. Pick one that matches your constraints. (Examples below use `m` from the earlier session.)

```python
from mellea.stdlib.sampling import (
    RejectionSamplingStrategy,
    MultiTurnStrategy,
    RepairTemplateStrategy
)
from mellea.stdlib.requirements import req

# Rejection Sampling: Keep trying until requirements are met (up to loop_budget)
rejection_agent = Agent(
    role="Writer",
    goal="Write quality content",
    backstory="You are a careful writer.",
    llm=MelleaLLM(
        mellea_session=m,
        requirements=[
            req("Response must be well-written and clear"),
            req("Response must include specific examples"),
        ],
        strategy=RejectionSamplingStrategy(loop_budget=5)
    )
)

# Multi-Turn Strategy: Agentic repair with conversation
multi_turn_agent = Agent(
    role="Editor",
    goal="Refine content through iteration",
    backstory="You are an experienced editor.",
    llm=MelleaLLM(
        mellea_session=m,
        requirements=[
            req("Response must be polished and professional"),
            req("Response must flow naturally"),
        ],
        strategy=MultiTurnStrategy(loop_budget=3)
    )
)

# Repair Template Strategy: Adds repair instructions to failed attempts
repair_agent = Agent(
    role="Reviewer",
    goal="Ensure quality standards",
    backstory="You are a quality assurance specialist.",
    llm=MelleaLLM(
        mellea_session=m,
        requirements=[
            req("Response must meet quality standards"),
            req("Response must be accurate and factual"),
        ],
        strategy=RepairTemplateStrategy(loop_budget=3)
    )
)
```

All require 2–5x more API calls and latency in exchange for higher quality output.

### Mixing Semantic and Deterministic Checks

Mix semantic checks (LLM-powered) with deterministic ones (Python rules). (Continuing with the session from above.)

```python
from mellea.stdlib.requirements import req, check, simple_validate

# LLM-validated: Does this text include evidence?
requirements = [
    req("Must include specific examples or statistics"),
    check("Do not include speculation"),
    
    # Fast rule-based checks
    req("Between 50-400 words",
        validation_fn=simple_validate(lambda x: 50 <= len(x.split()) <= 400, reason="Must be 50-400 words")),
    req("Must mention AI",
        validation_fn=simple_validate(lambda x: "ai" in x.lower())),
]

analyst = Agent(
    role="Data Analyst",
    goal="Provide data-driven insights",
    llm=MelleaLLM(
        mellea_session=m,
        requirements=requirements,
        strategy=RejectionSamplingStrategy(loop_budget=5),
    )
)
```

`req()` and `check()` use the LLM for semantic validation, while `validation_fn` runs Python for objective checks like word count. The key difference is *when* each one acts: `req()` embeds the requirement in the instruction prompt so the model sees it upfront and tries to meet it (use for things the model should actively target, like "Must cite sources"); `check()` only validates after generation, without priming the model (use for constraints you want to verify without shaping the output, like "Avoid speculation"). Deterministic checks are fast but rigid; semantic checks are flexible but slower. Negative constraints are also harder for LLMs to satisfy reliably than positive ones.

## Reusable Requirements

(Continuing with the session from above.)

```python
# Define reusable requirement sets
professional_requirements = [
    req("Must have professional tone"),
    req("Must be well-structured"),
]

accuracy_requirements = [
    req("Must include specific data points"),
    req("Must cite sources"),
]

# Compose and attach to agents
researcher_requirements = accuracy_requirements + [
    req("Between 300-400 words", 
        validation_fn=simple_validate(lambda x: 300 <= len(x.split()) <= 400, reason="Must be 300-400 words"))
]

writer_requirements = professional_requirements + [
    req("Between 400-600 words",
        validation_fn=simple_validate(lambda x: 400 <= len(x.split()) <= 600, reason="Must be 400-600 words"))
]

# Attach to agents
researcher = Agent(
    role="Researcher",
    goal="Research recent AI trends",
    backstory="You are a senior analyst.",
    llm=MelleaLLM(
        mellea_session=m,
        requirements=researcher_requirements,
        strategy=RejectionSamplingStrategy(loop_budget=5)
    )
)

writer = Agent(
    role="Writer",
    goal="Write engaging, well-structured content",
    backstory="You are a skilled content writer.",
    llm=MelleaLLM(
        mellea_session=m,
        requirements=writer_requirements,
        strategy=RejectionSamplingStrategy(loop_budget=3)
    )
)
```

### Task-Level Guardrails

```python
from mellea_crewai import create_guardrail, create_guardrails

# Step 1: Create a validation function as a plain callable
word_count_check = lambda x: 30 <= len(x.split()) <= 200
word_count_check.__doc__ = "Must be between 30-200 words"

# Step 2: Convert to a CrewAI guardrail
guardrail = create_guardrail(word_count_check)

# Step 3: Use the guardrail in your CrewAI task
# (Assuming agent defined in an earlier section)
task = Task(
    description="Write a summary about AI",
    expected_output="Brief AI summary",
    agent=agent,
    guardrails=[guardrail],
    guardrail_max_retries=3  # Retry up to 3 times if validation fails
)
# Output will be validated to ensure 30-200 words

# Create multiple guardrails for comprehensive validation
keyword_check = lambda x: any(kw in x for kw in ["AI", "machine learning"])
keyword_check.__doc__ = "Must mention AI or machine learning"

word_count_check = lambda x: 100 <= len(x.split()) <= 500
word_count_check.__doc__ = "Must be between 100-500 words"

# Convert to guardrails
guardrails = create_guardrails([keyword_check, word_count_check])

task = Task(
    description="Write about AI",
    expected_output="AI article",
    agent=agent,
    guardrails=guardrails,
    guardrail_max_retries=3
)
# Output will be validated to ensure:
# - Mentions "AI" or "machine learning"
# - Between 100-500 words
```

## When to Use Mellea

Mellea is built for batch processing, multi-agent workflows, and quality-critical tasks where you control latency. It's not for real-time interaction or streaming (not supported). LLM-based validation means extra API calls and latency, so use it when your quality or compliance requirements justify the cost.

**Good fit if:**

- You're building production multi-agent systems where quality beats speed
- You need validation checkpoints in content pipelines
- Your outputs must meet compliance or quality standards
- You're mixing backends (Ollama locally, OpenAI in prod)
- You need different validation rules across agents

**Skip it if:**

- You need sub-second responses (latency-sensitive systems)
- API budgets are tight and cost per token is your primary constraint
- You need streaming (not supported)
- Your pipeline already meets its quality bar and the extra calls aren't justified

## Next Steps

If one bad agent silently breaks your pipeline, validated crews are a drop-in fix. Start with the "Your First Validated Crew" example above.

For more details, see the [Mellea docs](https://docs.mellea.ai/), [CrewAI integration examples](https://github.com/generative-computing/mellea-contribs/tree/main/mellea_contribs/crewai_backend/examples), and the [Mellea Discord](https://ibm.biz/mellea-discord). This integration lives in [mellea-contribs](https://github.com/generative-computing/mellea-contribs).

---
title: "Structured Generative Programming for CrewAI: Multi-Agent Validation with Mellea"
date: "2026-04-28"
author: "Akihiko Kuroda"
excerpt: "Mellea brings structured validation and automatic repair to CrewAI multi-agent systems through the instruct-validate-repair pattern."
tags: ["crewai", "multi-agent", "validation", "integration"]
---

CrewAI makes it easy to build multi-agent workflows. One bad agent response cascades through the pipeline because CrewAI doesn't validate outputs.

**Mellea** adds automatic validation, structured requirements, and intelligent retry logic to your multi-agent crews.

> **Before you start:** Mellea trades latency and API costs for output quality. Expect 2-5x slower responses due to validation retries, and higher token usage. Streaming is not supported—responses return as a single chunk. This is ideal for batch processing and quality-critical applications, but not for real-time interaction or latency-sensitive systems.

## Installation

First, follow [Mellea's Getting Started guide](https://docs.mellea.ai/getting-started) to set up your environment (including Ollama if running locally).

Then install the CrewAI integration:

```bash
# 1. Install mellea and crewai
pip install mellea crewai

# 2. Install mellea-integration-core
pip install https://github.com/generative-computing/mellea-contribs/releases/download/mellea-integration-core/v0.1.0/mellea_integration_core-0.1.0-py3-none-any.whl

# 3. Install mellea-crewai
pip install https://github.com/generative-computing/mellea-contribs/releases/download/mellea-crewai/v0.1.0/mellea_crewai-0.1.0-py3-none-any.whl
```

## Your First Validated Crew

```python
from mellea import start_session
from mellea_crewai import MelleaLLM
from mellea.stdlib.requirements import req
from mellea.stdlib.sampling import RejectionSamplingStrategy
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
```

Multi-agent example:

```python
# Create specialized agents
researcher = Agent(
    role="Researcher",
    goal="Conduct thorough research",
    llm=MelleaLLM(
        mellea_session=m,
        requirements=[req("Must cite sources"), req("Must include data")],
        strategy=RejectionSamplingStrategy(loop_budget=5)
    )
)

writer = Agent(
    role="Writer",
    goal="Write engaging content",
    llm=MelleaLLM(
        mellea_session=m,
        requirements=[req("Must be well-structured"), req("Must be engaging")],
        strategy=MultiTurnStrategy(loop_budget=3)
    )
)

# Create tasks with dependencies
research_task = Task(
    description="Research AI trends",
    agent=researcher,
    expected_output="Research summary"
)

writing_task = Task(
    description="Write blog post based on research",
    agent=writer,
    expected_output="Blog post",
    context=[research_task]  # Depends on research
)

# Execute validated crew
crew = Crew(agents=[researcher, writer], tasks=[research_task, writing_task])
result = crew.kickoff()
```

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

**CrewAI generates once and returns whatever it gets.** With cascading failures, inconsistent validation scattered across tasks, and no feedback on what failed, multi-agent workflows break fast. A researcher's sloppy output becomes the writer's bad input.

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

## How Mellea Works

Mellea bakes validation into the generation loop itself. See the [Mellea docs](https://docs.mellea.ai/) for the full instruct-validate-repair pattern.

### Side-by-Side: CrewAI vs. Mellea

Building a research-to-content pipeline shows the difference. With pure CrewAI:

```python
from crewai import Agent, Task, Crew

researcher = Agent(
    role="Researcher",
    goal="Provide accurate information",
    backstory="You are an expert researcher"
)

writer = Agent(
    role="Writer",
    goal="Write engaging content",
    backstory="You are an expert writer"
)

research_task = Task(
    description="Research recent AI trends",
    agent=researcher,
    expected_output="Research summary"
)

writing_task = Task(
    description="Write blog post based on research",
    agent=writer,
    expected_output="Blog post",
    context=[research_task]
)

# Manual retry logic for the whole crew
max_attempts = 5
for attempt in range(max_attempts):
    crew = Crew(agents=[researcher, writer], tasks=[research_task, writing_task])
    result = crew.kickoff()
    
    # Manual validation checks
    is_good_research = "data" in result.lower() and len(result.split()) > 300
    is_well_written = len(result.split()) > 400 and "conclusion" in result.lower()
    
    if is_good_research and is_well_written:
        print(result)
        break
else:
    print("Failed after max attempts")
```

**With Mellea:**

```python
from mellea import start_session
from mellea_crewai import MelleaLLM
from mellea.stdlib.requirements import req, simple_validate
from mellea.stdlib.sampling import RejectionSamplingStrategy
from crewai import Agent, Task, Crew

m = start_session()

# Define specialized agents with requirements
researcher = Agent(
    role="Researcher",
    goal="Provide accurate information",
    backstory="You are an expert researcher",
    llm=MelleaLLM(
        mellea_session=m,
        requirements=[
            req("Must include specific data points or statistics"),
            req("Must cite sources"),
            req("Between 300-400 words", 
                validation_fn=simple_validate(lambda x: 300 <= len(x.split()) <= 400)),
        ],
        strategy=RejectionSamplingStrategy(loop_budget=5),
    )
)

writer = Agent(
    role="Writer",
    goal="Write engaging content",
    backstory="You are an expert writer",
    llm=MelleaLLM(
        mellea_session=m,
        requirements=[
            req("Must have clear section headings"),
            req("Must be engaging and readable"),
            req("Between 400-600 words",
                validation_fn=simple_validate(lambda x: 400 <= len(x.split()) <= 600)),
        ],
        strategy=RejectionSamplingStrategy(loop_budget=3),
    )
)

research_task = Task(
    description="Research recent AI trends",
    agent=researcher,
    expected_output="Research summary"
)

writing_task = Task(
    description="Write blog post based on research",
    agent=writer,
    expected_output="Blog post",
    context=[research_task]
)

# Automatic validation at each step
crew = Crew(agents=[researcher, writer], tasks=[research_task, writing_task])
result = crew.kickoff()
print(result)
```

**What changed:**

| Aspect | CrewAI | Mellea |
| ------ | ------ | ------ |
| **Retry logic** | Manual loop for entire crew | Automatic per-agent via `RejectionSamplingStrategy` |
| **Validation** | Hardcoded checks in loop | Declarative `req()` statements |
| **Debugging** | Pass/fail only | See which requirements failed at each attempt |
| **Reusability** | Validation code specific to this task | Requirements reused across agents |
| **Semantic validation** | Manual string checks | LLM-based validation via `req()` |
| **Agent specialization** | All agents same config | Each agent has custom rules |

### Automatic Validation and Retry

Define requirements your agents must meet, and Mellea validates and retries automatically:

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
```

The difference: Mellea generates → validates → retries up to loop_budget. Standard CrewAI generates once. If all retries fail, Mellea returns the first attempt.

### Sampling Strategies

Different strategies trade compute for quality. Pick the right one for your use case:

```python
from mellea.stdlib.sampling import (
    RejectionSamplingStrategy,
    MultiTurnStrategy,
    RepairTemplateStrategy
)

# Rejection Sampling: Keep trying until requirements are met (up to loop_budget)
rejection_agent = Agent(
    role="Writer",
    goal="Write quality content",
    llm=MelleaLLM(
        mellea_session=m,
        strategy=RejectionSamplingStrategy(loop_budget=5)
    )
)

# Multi-Turn Strategy: Agentic repair with conversation
multi_turn_agent = Agent(
    role="Editor",
    goal="Refine content through iteration",
    llm=MelleaLLM(
        mellea_session=m,
        strategy=MultiTurnStrategy(loop_budget=3)
    )
)

# Repair Template Strategy: Adds repair instructions to failed attempts
repair_agent = Agent(
    role="Reviewer",
    goal="Ensure quality standards",
    llm=MelleaLLM(
        mellea_session=m,
        strategy=RepairTemplateStrategy(loop_budget=3)
    )
)
```

All trade 2–5x more API calls and latency for higher quality output.

### Mixing Semantic and Deterministic Checks

Mix semantic checks (LLM-powered) with deterministic ones (Python rules):

```python
from mellea.stdlib.requirements import req, check, simple_validate

# LLM-validated: Does this text include evidence?
requirements = [
    req("Must include specific examples or statistics"),
    check("Do not include speculation"),
    
    # Fast rule-based checks
    req("Between 50-400 words",
        validation_fn=simple_validate(lambda x: 50 <= len(x.split()) <= 400)),
    req("Must mention AI",
        validation_fn=simple_validate(lambda x: "AI" in x.lower())),
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

`req()` and `check()` use the LLM to validate semantic properties (~1–2 seconds each). `validation_fn` runs Python code for objective checks like word count (< 1ms). Deterministic checks are fast; semantic checks are flexible but slower. Negative constraints (`check()`) are harder for LLMs to satisfy reliably than positive ones.

## Reusable Requirements

Define validation rules once and reuse them across agents. Each agent can have its own strategy.

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

# Compose once, use across agents
researcher_requirements = accuracy_requirements + [
    req("Between 300-400 words", 
        validation_fn=simple_validate(lambda x: 300 <= len(x.split()) <= 400))
]

writer_requirements = professional_requirements + [
    req("Between 400-600 words",
        validation_fn=simple_validate(lambda x: 400 <= len(x.split()) <= 600))
]

# Attach to agents
researcher = Agent(
    role="Researcher",
    llm=MelleaLLM(
        mellea_session=m,
        requirements=researcher_requirements,
        strategy=RejectionSamplingStrategy(loop_budget=5)
    )
)

writer = Agent(
    role="Writer",
    llm=MelleaLLM(
        mellea_session=m,
        requirements=writer_requirements,
        strategy=RejectionSamplingStrategy(loop_budget=3)
    )
)
```

### Task-Level Guardrails

Use Mellea requirements as guardrails in CrewAI tasks:

```python
from mellea_crewai import create_guardrail

# Step 1: Create a validation function (lambda with __doc__ for description)
word_count_check = lambda x: 30 <= len(x.split()) <= 200
word_count_check.__doc__ = "Must be between 30-200 words"

# Step 2: Convert to a CrewAI guardrail
guardrail = create_guardrail(word_count_check)

# Step 3: Use the guardrail in your CrewAI task
task = Task(
    description="Write a summary about AI",
    expected_output="Brief AI summary",
    agent=agent,
    guardrails=[guardrail],
    guardrail_max_retries=3  # Retry up to 3 times if validation fails
)

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
```

## Feature Comparison

| Feature | CrewAI Alone | With Mellea |
| ------- | ------------ | ----------- |
| **Agent Output Validation** | Manual, external | Built-in, automatic |
| **Retry Logic** | Manual implementation | Sophisticated sampling strategies |
| **Requirements** | Embedded in prompts | First-class, composable objects |
| **Validation Feedback** | None | Detailed results and reasoning |
| **Inference-Time Scaling** | Not supported | Multiple strategies (Rejection, MultiTurn, Repair) |
| **Task Guardrails** | Basic validation | Mellea requirements as guardrails |
| **Agent Specialization** | Same LLM config | Different validation per agent |
| **Semantic Validation** | Not available | LLM-as-a-judge built-in |
| **Deterministic Checks** | Manual | `simple_validate()` for fast checks |
| **Multi-Backend Support** | Limited | Ollama, OpenAI, WatsonX, HuggingFace, etc. |

## When to Use Mellea

Mellea fits batch processing, multi-agent workflows, and complex tasks where you control latency and each token counts. Don't use it for real-time interaction or streaming (not supported).

LLM-based validation requires extra API calls, so the accuracy of your requirements matters. Use Mellea when you have strict quality or compliance needs. The latency trade-off is worth it.

**Good fit if:**

- You're building production multi-agent systems where quality beats speed
- You need validation checkpoints in content pipelines
- Your outputs must meet compliance or quality standards
- You're mixing backends (Ollama locally, OpenAI in prod)
- You need different validation rules across agents

**Skip it if:**

- You need sub-second responses
- API budgets are tight
- You need streaming
- Output quality doesn't matter much

## Next Steps

Copy the "Your First Validated Crew" example at the top, save it as `validated_crew.py`, and run it.

For more, see the [Mellea docs](https://docs.mellea.ai/), [CrewAI integration examples](https://github.com/generative-computing/mellea-contribs/tree/main/mellea_contribs/crewai_backend/examples), and the [Mellea Discord](https://ibm.biz/mellea-discord).

This integration lives in [mellea-contribs](https://github.com/generative-computing/mellea-contribs).

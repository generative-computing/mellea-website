---
title: "Structured Generative Programming for CrewAI: Multi-Agent Validation with Mellea"
date: "2026-04-28"
author: "Akihiko Kuroda"
excerpt: "Mellea brings structured validation and automatic repair to CrewAI multi-agent systems through the instruct-validate-repair pattern."
tags: ["crewai", "multi-agent", "validation", "integration"]
---

CrewAI makes it easy to build multi-agent workflows. But it doesn't validate outputs. One bad agent response cascades through the pipeline.

**Mellea** validates LLM outputs and retries them until they pass. Drop it into your CrewAI crews as an LLM backend, and each agent's output either meets your requirements or falls back to a safe default.

## Getting Started

### Installation

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

### Your first validated agent:

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

## How Mellea Works

Mellea adds three concrete capabilities to CrewAI:

### 1. **Instruct-Validate-Repair Pattern for Agents**

Define requirements your agents must meet, and Mellea validates and retries automatically:

```python
from mellea import start_session
from mellea_crewai import MelleaLLM
from mellea.stdlib.requirements import req
from mellea.stdlib.sampling import RejectionSamplingStrategy
from crewai import Agent, Task, Crew

# Create Mellea-powered CrewAI agent
m = start_session()
llm = MelleaLLM(mellea_session=m)

# Define agent with explicit requirements that are achievable
validated_agent = Agent(
    role="Research Analyst",
    goal="Provide accurate, well-researched analysis",
    backstory="You are a senior analyst with expertise in AI trends. Write concise analysis with specific data points and clear conclusions.",
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
    description="Write a brief analysis of recent trends in large language models (around 200 words). Include specific statistics and data points, and provide clear conclusions about the trends.",
    agent=validated_agent,
    expected_output="Brief analysis with data and conclusions"
)

crew = Crew(agents=[validated_agent], tasks=[task])
result = crew.kickoff()

# Mellea automatically validates and retries until requirements are met
print(result)
```

This agent generates, validates against requirements, and retries on failure. Standard CrewAI generates once. Mellea generates → validates → retries up to loop_budget. If all fail, it returns the first attempt.

### 2. **Sampling Strategies**

Pick a retry strategy. Each trades latency and cost for quality:

```python
from mellea.stdlib.sampling import (
    RejectionSamplingStrategy,
    MultiTurnStrategy,
    RepairTemplateStrategy
)

# Rejection Sampling: Keep trying until requirements are met (up to loop_budget)
# Cost: Up to N agent calls + N validation calls
rejection_agent = Agent(
    role="Writer",
    goal="Write quality content",
    llm=MelleaLLM(
        mellea_session=m,
        strategy=RejectionSamplingStrategy(loop_budget=5)
    )
)

# Multi-Turn Strategy: Agentic multi-turn repair with conversation
# Cost: Multiple agent calls with conversational context
multi_turn_agent = Agent(
    role="Editor",
    goal="Refine content through iteration",
    llm=MelleaLLM(
        mellea_session=m,
        strategy=MultiTurnStrategy(loop_budget=3)
    )
)

# Repair Template Strategy: Adds repair instructions to failed attempts
# Cost: Up to N agent calls with repair context
repair_agent = Agent(
    role="Reviewer",
    goal="Ensure quality standards",
    llm=MelleaLLM(
        mellea_session=m,
        strategy=RepairTemplateStrategy(loop_budget=3)
    )
)
```

All of these trade more API calls and latency (2–5x typical) for higher quality output.

### 3. **Requirements: Semantic and Deterministic**

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

## What Mellea Adds to CrewAI

### Validated Agent Output

Standard CrewAI agents run once. Mellea agents validate against your requirements and retry if they don't pass:

```python
# Standard CrewAI: generates once, no validation
standard_agent = Agent(
    role="Writer",
    goal="Write content",
    llm=standard_llm
)

# With Mellea: validates and retries
validated_agent = Agent(
    role="Writer",
    goal="Write quality content",
    llm=MelleaLLM(
        mellea_session=m,
        requirements=[
            req("Must be well-structured with clear sections"),
            req("Must include specific examples"),
        ],
        strategy=RejectionSamplingStrategy(loop_budget=5),
    )
)
```

The cost: potentially 5x latency and API spend if all retries fire. It's worth it when reliability matters more than speed.

### Task-Level Guardrails

You can use Mellea requirements as guardrails directly:

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

### Per-Agent Customization

Each agent gets its own validation rules and strategy:

```python
# Researcher with strict accuracy requirements
researcher = Agent(
    role="Senior Researcher",
    goal="Conduct thorough research",
    llm=MelleaLLM(
        mellea_session=m,
        temperature=0.3,  # Lower temperature for accuracy
        requirements=[
            req("Must cite specific sources"),
            req("Must include data points"),
            check("Avoid speculation"),
        ],
        strategy=RejectionSamplingStrategy(loop_budget=5),
    )
)

# Writer with creative freedom but structure requirements
writer = Agent(
    role="Content Writer",
    goal="Write engaging content",
    llm=MelleaLLM(
        mellea_session=m,
        temperature=0.7,  # Higher temperature for creativity
        requirements=[
            req("Must be engaging and readable"),
            req("Must be well-structured"),
        ],
        strategy=RejectionSamplingStrategy(loop_budget=2),
    )
)

# Editor with strict quality control
editor = Agent(
    role="Senior Editor",
    goal="Ensure quality and consistency",
    llm=MelleaLLM(
        mellea_session=m,
        temperature=0.2,  # Very low temperature for consistency
        requirements=[
            req("Must maintain consistency"),
        ],
        strategy=RejectionSamplingStrategy(loop_budget=2),
    )
)

# Create crew with specialized agents
crew = Crew(
    agents=[researcher, writer, editor],
    tasks=[research_task, writing_task, editing_task],
    verbose=True
)
```

### Tool Output Validation

Agent tools can also be validated:

```python
from crewai.tools import tool

@tool
def search_database(query: str) -> str:
    """Search the product database."""
    # Your search implementation
    return results

# Agent with tool calling and output validation
sales_agent = Agent(
    role="Sales Assistant",
    goal="Help customers find products",
    tools=[search_database],
    llm=MelleaLLM(
        mellea_session=m,
        requirements=[
            req("Must provide accurate product information"),
            req("Must include pricing and availability"),
            req("Must be helpful and professional"),
        ],
        strategy=RejectionSamplingStrategy(loop_budget=3),
    )
)
```

## Building Multi-Agent Workflows

Here's what a validated crew looks like:

```python
# Guarantee quality at each step
crew = Crew(
    agents=[
        Agent(role="Researcher", llm=MelleaLLM(
            mellea_session=m,
            requirements=[req("Must cite sources"), req("Must include data")],
            strategy=RejectionSamplingStrategy(loop_budget=5)
        )),
        Agent(role="Writer", llm=MelleaLLM(
            mellea_session=m,
            requirements=[req("Must be well-structured"), req("Must be engaging")],
            strategy=MultiTurnStrategy(loop_budget=3)
        )),
        Agent(role="Editor", llm=MelleaLLM(
            mellea_session=m,
            requirements=[req("Must be error-free"), req("Must be consistent")],
            strategy=RejectionSamplingStrategy(loop_budget=3)
        )),
    ],
    tasks=[research_task, writing_task, editing_task]
)
result = crew.kickoff()  # Each agent's output is validated before moving to the next
```

### Task Dependencies

Validate inputs to downstream tasks so they start with quality inputs:

```python
# Ensure research quality before analysis begins
research_task = Task(
    description="Research AI trends",
    agent=researcher,
    guardrails=[
        word_count_guardrail(min_words=300, max_words=500),
        contains_keywords_guardrail(["data", "statistics"]),
    ],
    guardrail_max_retries=3
)

analysis_task = Task(
    description="Analyze the research",
    agent=analyst,
    context=[research_task],  # Now guaranteed to be quality input
    guardrails=[
        word_count_guardrail(min_words=200, max_words=400),
    ],
    guardrail_max_retries=3
)
```

### Agent Specialization

You can tune validation and temperature per role:

```python
# Each agent has specialized validation
researcher = Agent(
    role="Researcher",
    llm=MelleaLLM(
        mellea_session=m,
        temperature=0.3,
        requirements=[req("Must be accurate"), req("Must cite sources")]
    )
)

writer = Agent(
    role="Writer",
    llm=MelleaLLM(
        mellea_session=m,
        temperature=0.7,
        requirements=[req("Must be engaging"), req("Must be well-structured")]
    )
)
```

## Example: Content Production Pipeline

Standard CrewAI agents generate once. Here's what that looks like:

```python
researcher = Agent(role="Researcher", goal="Research topics", llm=standard_llm)
writer = Agent(role="Writer", goal="Write content", llm=standard_llm)
editor = Agent(role="Editor", goal="Edit content", llm=standard_llm)

research_task = Task(
    description="Research AI trends",
    agent=researcher,
    expected_output="Research summary"
)

writing_task = Task(
    description="Write blog post based on research",
    agent=writer,
    expected_output="Blog post",
    context=[research_task]
)

editing_task = Task(
    description="Edit the blog post",
    agent=editor,
    expected_output="Final blog post",
    context=[writing_task]
)

crew = Crew(agents=[researcher, writer, editor], tasks=[research_task, writing_task, editing_task])
result = crew.kickoff()
```

With Mellea, add validation at each step:

```python
researcher = Agent(
    role="Senior Researcher",
    goal="Conduct thorough research",
    llm=MelleaLLM(
        mellea_session=m,
        temperature=0.3,
        requirements=[
            req("Must include specific data points or statistics"),
            req("Must cite sources"),
            req("Between 300-400 words"),
            check("Avoid speculation without evidence"),
        ],
        strategy=RejectionSamplingStrategy(loop_budget=5),
    )
)

writer = Agent(
    role="Content Writer",
    goal="Write engaging content",
    llm=MelleaLLM(
        mellea_session=m,
        temperature=0.7,
        requirements=[
            req("Must have clear section headings"),
            req("Must be engaging and readable"),
            req("Between 400-600 words"),
            req("Must include examples from research"),
        ],
        strategy=MultiTurnStrategy(loop_budget=3),
    )
)

editor = Agent(
    role="Senior Editor",
    goal="Ensure quality",
    llm=MelleaLLM(
        mellea_session=m,
        temperature=0.2,
        requirements=[
            req("Identify any factual inconsistencies"),
            req("Check for clarity and readability"),
            check("Do not add new information"),
        ],
        strategy=RejectionSamplingStrategy(loop_budget=3),
    )
)

# Create tasks with guardrails
research_task = Task(
    description="Research AI trends",
    agent=researcher,
    expected_output="Research summary",
    guardrails=[
        word_count_guardrail(min_words=300, max_words=400),
        contains_keywords_guardrail(["data", "statistics"]),
    ],
    guardrail_max_retries=3
)

writing_task = Task(
    description="Write blog post based on research",
    agent=writer,
    expected_output="Blog post",
    context=[research_task],
    guardrails=[
        word_count_guardrail(min_words=400, max_words=600),
    ],
    guardrail_max_retries=3
)

editing_task = Task(
    description="Edit the blog post",
    agent=editor,
    expected_output="Final blog post",
    context=[writing_task]
)

# Execute with validation at each step
crew = Crew(agents=[researcher, writer, editor], tasks=[research_task, writing_task, editing_task])
result = crew.kickoff()
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

**Good fit if:**

- You're building production multi-agent systems where quality beats speed
- You need validation checkpoints in content pipelines
- Your outputs must meet compliance or quality standards
- You're mixing backends (Ollama locally, OpenAI in prod)
- You need different validation rules across roles

**Skip it if:**

- You need sub-second responses (validation costs 2–5x latency)
- You're doing single-agent Q&A
- API budgets are tight
- You need streaming
- Basic CrewAI validation is enough

## Limitations

Mellea trades speed for quality. Validation and retries add 2–5x latency per agent. API costs scale with loop_budget and the number of agents in your crew. LLM-as-judge validation is only as good as your validator model. No streaming support yet. Structured requirements add a bit of code overhead, but the payoff usually justifies it.

## Architecture: How It Works

```text
┌─────────────────────────────────────────────────────────┐
│         Your CrewAI Application                          │
│         (Agents, Tasks, Crews, Tools)                    │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│         MelleaLLM (BaseLLM Interface)                    │
│         • Implements CrewAI's BaseLLM                    │
│         • Accepts requirements & strategies              │
│         • Handles tool calling                           │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│         Mellea's Generative Programming Layer            │
│         ┌─────────────────────────────────────────┐     │
│         │  Instruct-Validate-Repair Loop          │     │
│         │  1. Generate agent output               │     │
│         │  2. Validate against requirements       │     │
│         │  3. If invalid, retry with feedback     │     │
│         │  4. Return validated output             │     │
│         └─────────────────────────────────────────┘     │
│         ┌─────────────────────────────────────────┐     │
│         │  Sampling Strategies                    │     │
│         │  • RejectionSampling                    │     │
│         │  • MultiTurn                            │     │
│         │  • RepairTemplate                       │     │
│         └─────────────────────────────────────────┘     │
│         ┌─────────────────────────────────────────┐     │
│         │  Requirements System                    │     │
│         │  • LLM-based validation (semantic)      │     │
│         │  • Deterministic validation (fast)      │     │
│         │  • Composable requirements              │     │
│         └─────────────────────────────────────────┘     │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│         Mellea Backends                                  │
│         (Ollama, OpenAI, WatsonX, HuggingFace, etc.)    │
└─────────────────────────────────────────────────────────┘
```

MelleaLLM wraps Mellea sessions inside CrewAI and handles message and tool format translation.

## Takeaways

Treat agent outputs like program specs. Validate and retry until they pass. Use semantic checks (LLM validation) for nuance and deterministic checks (Python rules) for speed. Each agent gets its own strategy. Hook requirements into task guardrails. The tradeoff is clear: more validation costs latency and API budget, but gets you higher quality output. Use it when reliability matters more than speed.

## Learn More

- [Mellea Documentation](https://docs.mellea.ai/)
- [GitHub Examples](https://github.com/generative-computing/mellea-contribs/tree/main/mellea_contribs/crewai_backend/examples)
- [CrewAI Docs](https://docs.crewai.com/)
- [Mellea Discord](https://ibm.biz/mellea-discord)

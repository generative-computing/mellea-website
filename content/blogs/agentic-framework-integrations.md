---
title: "Mellea Meets AI Frameworks: Structured Validation for LangChain, CrewAI, and DSPy"
date: "2026-04-24"
author: "Akihiko Kuroda"
excerpt: "How Mellea brings structured validation and automatic retry to LangChain, CrewAI, and DSPy"
tags: ["integration", "framework"]
---

Building reliable AI applications requires more than good models—it requires validation. Whether you're orchestrating chains with LangChain, coordinating agents with CrewAI, or writing structured programs with DSPy, output quality determines whether your application works in production.

Mellea adds structured validation and automatic retry to these frameworks. Here's how three integrations address this:

## Mellea + LangChain: Validated Chains

LangChain chains generate once and hope for the best. Invalid outputs crash downstream components or force manual retry logic.

With Mellea, you get built-in requirements validation and automatic retry:

```python
from mellea import start_session
from mellea_langchain import MelleaChatModel
from mellea.stdlib.requirements import req
from mellea.stdlib.sampling import RejectionSamplingStrategy
from langchain_core.prompts import ChatPromptTemplate

m = start_session()
chat_model = MelleaChatModel(mellea_session=m)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant"),
    ("human", "Write a blog post about {topic}")
])

# Validated chain with quality guarantees
chain = prompt | chat_model.bind(
    model_options={
        "requirements": [
            req("Must include a clear introduction"),
            req("Must be between 500-1000 words"),
            req("Must include practical examples"),
        ],
        "strategy": RejectionSamplingStrategy(loop_budget=3),
    }
)

result = chain.invoke({"topic": "AI reliability"})
# Returns first output that passes all requirements, or best attempt after loop_budget retries
```

Requirements validation runs without manual retry logic. Mellea validates and retries up to `loop_budget` times, returning the first passing output or the best attempt if all retries fail.

## Mellea + CrewAI: Multi-Agent Reliability

Multi-agent workflows suffer from cascading quality issues. When one agent's output is poor, downstream agents work with bad data.

Mellea validates each agent's output independently:

```python
from mellea import start_session
from mellea_crewai import MelleaLLM
from mellea.stdlib.requirements import req, check
from mellea.stdlib.sampling import RejectionSamplingStrategy
from crewai import Agent, Task, Crew

m = start_session()

# Researcher with strict accuracy requirements
researcher = Agent(
    role="Senior Researcher",
    goal="Conduct thorough research",
    backstory="You are an expert researcher with decades of experience",
    llm=MelleaLLM(
        mellea_session=m,
        requirements=[
            req("Must cite specific sources"),
            req("Must include data points"),
            check("Avoid speculation"),
        ],
        strategy=RejectionSamplingStrategy(loop_budget=5),
    )
)

# Writer with creative freedom
writer = Agent(
    role="Content Writer",
    goal="Write engaging content",
    backstory="You are an accomplished writer with a talent for engaging audiences",
    llm=MelleaLLM(
        mellea_session=m,
        requirements=[
            req("Must be well-structured"),
            req("Must be engaging"),
        ],
        strategy=RejectionSamplingStrategy(loop_budget=3),
    )
)

# Create tasks
research_task = Task(
    description="Research AI reliability and produce a detailed report with sources",
    expected_output="A detailed research report with cited sources and data points",
    agent=researcher
)

writing_task = Task(
    description="Write an engaging blog post based on the research findings",
    expected_output="An engaging and well-structured blog post",
    agent=writer
)

crew = Crew(agents=[researcher, writer], tasks=[research_task, writing_task])
result = crew.kickoff()
# Each agent's output is validated for quality
```

**`req` vs. `check`:** Both validate responses, but differently:

- `req()` — Hard requirement included in the instruction prompt. The model sees this and is told to satisfy it.
- `check()` — Soft check used only during validation. The model doesn't see it; it's verified after generation.

Use `req()` for requirements the model should actively satisfy (e.g., "Must cite sources"). Use `check()` for constraints to verify without biasing generation (e.g., "Avoid speculation").

Quality control happens at each pipeline step. Researchers produce well-sourced content, writers produce engaging copy—automatically.

## Mellea + DSPy: Validated Structured Programs

DSPy provides structure through signatures, but doesn't guarantee outputs meet quality requirements. Generated documentation might be incomplete, summaries might miss key points.

Mellea treats validation as a first-class citizen:

```python
import dspy
from mellea import start_session
from mellea_dspy import MelleaLM
from mellea.stdlib.requirements import req
from mellea.stdlib.sampling import RejectionSamplingStrategy

# Configure Mellea LM with requirements
m = start_session()
lm = MelleaLM(
    mellea_session=m,
    model="mellea-ollama",
    requirements=[
        req("Must be under 200 words"),
        req("Must include usage examples"),
        req("Must explain parameters"),
        req("Must be clear and professional"),
    ],
    strategy=RejectionSamplingStrategy(loop_budget=3)
)
dspy.configure(lm=lm)

# DSPy signature - validation happens automatically
doc_gen = dspy.Predict("code -> documentation")
result = doc_gen(code="def calculate_total(items): ...")
# Documentation automatically meets all requirements
```

Structured outputs are validated against your requirements. If retries are exhausted, Mellea returns the best attempt with validation feedback. This works well for documentation generation, content production, and other structured tasks.

## The Core Pattern: Instruct-Validate-Repair

All three integrations use the same approach:

1. **Instruct** — Generate output using the framework's LLM
2. **Validate** — Check output against requirements using LLM-as-a-judge
3. **Repair** — Retry with feedback up to `loop_budget` attempts if invalid
4. **Return** — First valid output or best attempt

This treats LLM outputs as programs that must meet specifications, not text that hopefully works.

## Quality vs. Speed

Mellea's validation adds:

- **Latency** — Each retry is one additional LLM call. Worst-case latency is `loop_budget × base_latency`.
- **API costs** — Proportional to retries and requirements
- **Reliability** — Outputs validated against your specs, with detailed feedback when requirements aren't met

Use Mellea when quality matters more than latency. For most production scenarios, that's the right tradeoff.

| Scenario | Without Mellea | With Mellea |
| --- | --- | --- |
| **LangChain** | Manual validation loops | Automatic retry with requirements |
| **CrewAI** | Quality issues cascade | Each agent validated independently |
| **DSPy** | Structure but no quality guarantee | Requirements validated at generation |
| **Latency** | 1× (single generation) | 1–loop_budget × (e.g., 1–3× with budget=3) |
| **Cost** | Manual retries (unpredictable) | Controlled retries (configurable budget) |
| **Debugging** | "Why did this fail?" | Detailed validation feedback |

## Getting Started

Pre-built packages are coming soon. For now, see the [mellea-contribs repository](https://github.com/generative-computing/mellea-contribs) for installation instructions.

Configure your framework to use Mellea's LM and define your requirements. Validation happens automatically.

Each integration includes example code, API documentation, and latency/cost considerations. Check the [mellea-contribs repository](https://github.com/generative-computing/mellea-contribs) for complete examples.

---

Treating LLM outputs as programs with specifications improves reliability. Mellea brings this to LangChain, CrewAI, and DSPy.

*This integration is part of [mellea-contribs](https://github.com/generative-computing/mellea-contribs), an incubation point for Mellea ecosystem contributions.*

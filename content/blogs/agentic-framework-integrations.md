---
title: "Mellea Meets AI Frameworks: Structured Validation for LangChain, CrewAI, and DSPy"
date: "2026-04-24"
author: "Akihiko Kuroda"
excerpt: "How Mellea brings structured validation and automatic retry to LangChain, CrewAI, and DSPy"
tags: ["integration", "framework"]
---

Building reliable AI applications requires more than good models—it requires validation. LangChain, CrewAI, and DSPy all handle orchestration, but none validate output quality. That determines whether your application actually works in production.

Mellea adds structured validation and automatic retry to all three.

## Mellea + LangChain: Validated Chains

Without validation, LangChain chains pass whatever the model generates downstream. Invalid outputs crash components or get manually retried.

Mellea adds validation and automatic retry:

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

Mellea validates each output and retries up to `loop_budget` times, returning the first pass or the best attempt once the budget is exhausted.

## Mellea + CrewAI: Multi-Agent Reliability

In multi-agent workflows, poor output from one agent degrades downstream results. Mellea validates each agent independently:

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

`req()` embeds requirements in the instruction prompt so the model sees them upfront. `check()` validates only after generation, without priming the model.

Use `req()` for things the model should actively target ("Must cite sources"). Use `check()` for constraints you want to verify without shaping generation ("Avoid speculation").

Each pipeline step validates independently. Researchers produce sourced content, writers produce structured copy — requirements enforced, not assumed.

## Mellea + DSPy: Validated Structured Programs

DSPy provides structure through signatures but doesn't guarantee output quality. Documentation might be incomplete or summaries might miss key points.

Mellea adds validation to DSPy:

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

Each output is validated against your requirements. If the budget is exhausted, Mellea returns the best attempt with feedback. This scales to documentation, content, and any structured output.

## The Core Pattern: Instruct-Validate-Repair

All three integrations follow the same approach:

1. **Instruct** — Generate output using the framework's LLM
2. **Validate** — Check output against requirements using LLM-as-a-judge
3. **Repair** — Retry with feedback up to `loop_budget` attempts if invalid
4. **Return** — First valid output or best attempt

Treat LLM outputs like code that must meet specifications, not text that hopefully works.

## Quality vs. Speed

Validation adds latency (each retry is one LLM call, worst-case `loop_budget × base_latency`) and API costs proportional to retries. You get reliability: outputs validated against your specs, with detailed feedback when validation fails.

Use Mellea when quality matters more than latency. For most production systems, that's the right tradeoff.

| Scenario | Without Mellea | With Mellea |
| --- | --- | --- |
| **LangChain** | Manual validation loops | Automatic retry with requirements |
| **CrewAI** | Quality issues cascade | Each agent validated independently |
| **DSPy** | Structure but no quality guarantee | Requirements validated at generation |
| **Latency** | 1× (single generation) | 1–loop_budget × (e.g., 1–3× with budget=3) |
| **Cost** | Manual retries (unpredictable) | Controlled retries (configurable budget) |
| **Debugging** | "Why did this fail?" | Detailed validation feedback |

## Getting Started

Pre-built packages are coming soon. For now, install from the [mellea-contribs repository](https://github.com/generative-computing/mellea-contribs).

Configure your framework to use Mellea's LM and define your requirements. Validation runs on every call. Each integration includes example code, API documentation, and cost/latency tradeoffs in the repository.

---

Treating LLM outputs as code that must meet specifications improves reliability. Mellea brings this to LangChain, CrewAI, and DSPy; these integrations are part of [mellea-contribs](https://github.com/generative-computing/mellea-contribs), an incubation space for ecosystem contributions.

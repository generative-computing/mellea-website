---
title: "What Mellea Brings to DSPy: Structured Validation for Reliable AI Programs"
date: "2026-05-06"
author: "Akihiko Kuroda"
excerpt: "Add semantic validation and quality guarantees to DSPy programs with Mellea's integration for structured prompting and runtime verification."
tags: ["dspy", "generative-programming", "llm", "validation", "reliability"]
---

DSPy changed how developers build LLM applications — structured prompting with signatures and modular programs instead of hand-crafted prompts. But as applications move to production, a critical challenge remains: **how do you ensure that structured outputs consistently meet quality requirements?**

**Mellea** solves this. It's a generative programming framework that validates outputs at the LM level, catching quality issues before they reach your application. The **Mellea-DSPy integration** connects Mellea's validation directly into DSPy workflows.

## What is DSPy?

[DSPy](https://github.com/stanfordnlp/dspy) (Declarative Self-improving Python) is a framework for programming—not prompting—language models. Instead of writing brittle prompts, you define signatures that specify what your program should do, and DSPy handles the prompting automatically.

Signatures are type-safe input/output specifications (e.g., `"question -> answer"`). You compose them with reusable modules like `Predict` and `ChainOfThought`, and DSPy can optimize your program through compilation. The modularity means you can build complex systems from simple building blocks.

## Getting Started

### Installation

First, follow [Mellea's Getting Started guide](https://docs.mellea.ai/getting-started) to set up your environment (including Ollama if running locally).

Then install the DSPy integration:

```bash
# 1. Install mellea and dspy
uv pip install mellea dspy

# Latest releases: https://github.com/generative-computing/mellea-contribs/releases
# 2. Install mellea-integration-core
uv pip install https://github.com/generative-computing/mellea-contribs/releases/download/mellea-integration-core/v0.1.0/mellea_integration_core-0.1.0-py3-none-any.whl

# 3. Install mellea-dspy
uv pip install https://github.com/generative-computing/mellea-contribs/releases/download/mellea-dspy/v0.1.0/mellea_dspy-0.1.0-py3-none-any.whl
```

### Your First Validated DSPy Program

```python
import dspy
from mellea import start_session
from mellea_dspy import MelleaLM
from mellea.stdlib.sampling import RejectionSamplingStrategy

# Step 1: Create Mellea session
m = start_session()  # Uses Ollama by default

# Step 2: Configure MelleaLM with requirements
lm = MelleaLM(
    mellea_session=m,
    requirements=[
        "Must be clear",
        "Must mention structured approaches or automation",
        "Must be professional"
    ],
    strategy=RejectionSamplingStrategy(loop_budget=3)
)

# Step 3: Configure DSPy to use Mellea LM
dspy.configure(lm=lm)

# Step 4: Define and use your DSPy program
qa = dspy.ChainOfThought("question -> answer")
result = qa(question="What is generative programming?")

print(result.answer)
# Generative programming is a structured approach to software development
# where formal specifications drive the automated production of code or other
# artifacts, enabling systematic automation of repetitive programming tasks.
```

**Note:** Keep this first snippet running in your session. All the code examples below assume `m` (the Mellea session), `dspy`, and the required imports are already in scope. You can copy each example and run it after the setup above.

### Configuration Options

```python
# With generation parameters
lm = MelleaLM(
    mellea_session=m,
    temperature=0.7,      # Control randomness
    max_tokens=2000       # Maximum output length
)

# With default requirements (applied to all generations)
lm = MelleaLM(
    mellea_session=m,
    requirements=["Must be concise", "Must be helpful"]
)
```

## What Makes Mellea + DSPy Different?

DSPy gives you structure; Mellea adds validation:

### The Core Innovation: Signatures + Requirements

```python
lm = MelleaLM(
    mellea_session=m,
    requirements=["Must be concise", "Must be accurate", "Must be helpful"],
    strategy=RejectionSamplingStrategy(loop_budget=3)
)
dspy.configure(lm=lm)

# Define structured signature - requirements automatically applied
qa = dspy.Predict("question -> answer")
result = qa(question="What is the capital of France?")

print(result.answer)
# Paris
```

Mellea validates the output against your requirements and automatically retries if they're not met. Standard DSPy doesn't do this.

## Mellea's Unique Functions in DSPy

### Requirements as Quality Gates

DSPy generates structured outputs, but without validation you can't guarantee they meet your criteria. Mellea lets you enforce requirements at generation time:

```python
from mellea.stdlib.sampling import RejectionSamplingStrategy

# Without Mellea
qa = dspy.Predict("text -> summary")
result = qa(text="Long article...")  # May exceed length or miss key points

# With Mellea
lm = MelleaLM(
    mellea_session=m,
    requirements=[
        "Must be under 50 words",
        "Must mention key points",
        "Must be professional"
    ],
    strategy=RejectionSamplingStrategy(loop_budget=3)
)
dspy.configure(lm=lm)

summarizer = dspy.Predict("text -> summary")
result = summarizer(text="Long article...")
# Output meets requirements or you get detailed feedback on what failed
```

### Semantic Validation

Rule-based validators can't reason about meaning. When paired with RejectionSamplingStrategy, Mellea uses the LLM itself to regenerate outputs that satisfy semantic requirements:

```python
from mellea.stdlib.sampling import RejectionSamplingStrategy

# Configure LM with semantic requirements
lm = MelleaLM(
    mellea_session=m,
    requirements=[
        "Must be professional and empathetic",
        "Must address the customer's concern",
        "Must provide actionable next steps"
    ],
    strategy=RejectionSamplingStrategy(loop_budget=3)
)
dspy.configure(lm=lm)

# Use DSPy signature - semantic validation happens automatically
support_writer = dspy.Predict("issue -> response")
result = support_writer(issue="Customer has a billing issue and is frustrated")
# Mellea validates semantic requirements and regenerates until they're met
```

### Runtime Verification with BestOfN

Single generations can fail. BestOfN generates N candidates and picks the one that best meets your requirements:

```python
from mellea_dspy import MelleaBestOfN

# Configure LM
lm = MelleaLM(mellea_session=m)
dspy.configure(lm=lm)

# Define your DSPy module
qa = dspy.ChainOfThought("question -> answer")

# Wrap with BestOfN verification
best_of_5 = MelleaBestOfN(
    module=qa,
    N=5,  # Generate 5 candidates
    requirements=[
        "Must be under 3 words",      # routes to _create_max_words_reward
        "Must be professional"         # routes to _create_professional_reward
    ],
    threshold=0.8
)

# Automatically selects the best answer from 5 attempts
result = best_of_5(question="What is the capital of Belgium?")
print(result.answer)  # "Brussels"
```

This trades compute for quality. It's a form of inference-time scaling.

**Note on requirements:** BestOfN and Refine use rule-based pattern matching in `verification.py`. Requirements must match specific patterns to work correctly:

- Length: "Must be under X words", "at least X words", "between X and Y words", "under X characters"
- Content: "Must mention X", "Must include X", "Must not mention X" (single terms only)
- Format: "Must be in bullet points", "numbered list", "valid JSON"
- Quality: "Must be concise", "detailed", "professional"

Requirements that don't match these patterns fall back to substring matching, which may not work as expected.

### Iterative Refinement

When generation isn't enough, the Refine strategy iteratively improves outputs:

```python
from mellea_dspy import MelleaRefine

# Define module
summarizer = dspy.Predict("text -> summary")

# Wrap with Refine for iterative improvement
refiner = MelleaRefine(
    module=summarizer,
    N=3,  # Up to 3 refinement iterations
    requirements=[
        "Must be under 50 words",
        "Must mention AI"              # single term — extracts "ai", substring match
    ],
    threshold=0.9
)

result = refiner(text="Long article about AI...")
# Iteratively refines until requirements are met
```

### Choosing the Right Strategy

**RejectionSamplingStrategy** is the default: regenerate until requirements pass. **MelleaBestOfN** makes sense when compute is cheap: generate N candidates at higher temperature and pick the best. **MelleaRefine** is for improving an existing output, not generating a new one.

## How Mellea Enhances DSPy Patterns

### Enhanced Structured Prompting

**Standard DSPy:**

```python
# Structure but no validation
class Summarize(dspy.Signature):
    """Summarize text concisely."""
    text = dspy.InputField()
    summary = dspy.OutputField()

summarizer = dspy.Predict(Summarize)
result = summarizer(text="Long article...")  # No guarantee about length or quality
```

**Mellea-Enhanced DSPy:**

```python
# Structure + validation with LM-level requirements
from mellea.stdlib.sampling import RejectionSamplingStrategy

# Configure LM with requirements
lm = MelleaLM(
    mellea_session=m,
    requirements=[
        "Must be under 100 words",
        "Must capture main points"
    ],
    strategy=RejectionSamplingStrategy(loop_budget=3)
)
dspy.configure(lm=lm)

# The summarizer now validates before returning
summarizer = dspy.Predict(Summarize)
result = summarizer(text="Long article...")
# Output meets your requirements
```

### Enhanced Chain of Thought

**Standard DSPy:**

```python
cot = dspy.ChainOfThought("question -> answer")
result = cot(question="Complex question...")
# Reasoning may be unclear or incomplete
```

**Mellea-Enhanced:**

```python
from mellea.stdlib.sampling import RejectionSamplingStrategy

# Configure LM with requirements
lm = MelleaLM(
    mellea_session=m,
    requirements=[
        "Must show clear reasoning steps",
        "Must include concrete examples",
        "Must be logical and coherent"
    ],
    strategy=RejectionSamplingStrategy(loop_budget=3)
)
dspy.configure(lm=lm)

# ChainOfThought now validates reasoning against requirements
cot = dspy.ChainOfThought("question -> answer")
result = cot(question="Explain how machine learning models learn from data")
# Reasoning meets your quality bars before it's returned
```

### Enhanced Modular Programs

```python
from mellea.stdlib.sampling import RejectionSamplingStrategy

class ValidatedQA(dspy.Module):
    def __init__(self):
        super().__init__()
        self.predictor = dspy.Predict("question -> answer")
    
    def forward(self, question):
        # DSPy predictor automatically uses configured Mellea LM with validation
        return self.predictor(question=question)

# Configure Mellea LM with requirements
m = start_session()
lm = MelleaLM(
    mellea_session=m,
    requirements=[
        "Must be informative and clear",
        "Must be helpful"
    ],
    strategy=RejectionSamplingStrategy(loop_budget=5)
)
dspy.configure(lm=lm)

# The module validates all outputs before returning them
qa_module = ValidatedQA()
answer = qa_module(question="What is Python?")
# All outputs checked against requirements
```

## Real-World Impact: Before and After Mellea

### Scenario: Technical Documentation Generator

**Before Mellea (Standard DSPy):**

```python
# Generate documentation
doc_gen = dspy.Predict("code -> documentation")
docs = doc_gen(code="def factorial(n): ...")

# Manual validation
if len(docs.documentation.split()) > 200:
    # Too long, try again
    docs = doc_gen(code="def factorial(n): ...", hint="be concise")

if "example" not in docs.documentation.lower():
    # Missing examples, try again
    docs = doc_gen(code="def factorial(n): ...", hint="include examples")

# Still might not meet all requirements!
```

**After Mellea:**

```python
from mellea.stdlib.sampling import RejectionSamplingStrategy

# Configure with guaranteed quality requirements
lm = MelleaLM(
    mellea_session=m,
    requirements=[
        "Must be under 200 words",
        "Must include usage examples and explain parameters",
        "Must be professional"
    ],
    strategy=RejectionSamplingStrategy(loop_budget=3)
)
dspy.configure(lm=lm)

# Generate with DSPy—validation is built in
doc_gen = dspy.Predict("code -> documentation")
result = doc_gen(code="def factorial(n): ...")
# Output meets requirements or you see what failed
```

## What Mellea Adds That DSPy Doesn't Have

| Feature                    | DSPy Alone                    | With Mellea                                |
| -------------------------- | ----------------------------- | ------------------------------------------ |
| **Output Structure**       | Signatures define structure   | ✓ Same                                     |
| **Output Validation**      | Not built-in                  | ✓ Automatic requirements validation        |
| **Semantic Checks**        | Not available                 | ✓ Rule-based + LLM-driven validation       |
| **Runtime Verification**   | Not available                 | ✓ BestOfN and Refine strategies            |
| **Quality Guarantees**     | Hope for the best             | ✓ Requirements must be met                 |
| **Validation Feedback**    | None                          | ✓ Detailed pass/fail results               |
| **Multi-Backend Support**  | Limited                       | ✓ Ollama, OpenAI, Anthropic, etc.          |

## When to Use This Integration

Use Mellea if you're building production systems where output quality is non-negotiable: internal documentation generators, compliance workflows, customer-facing content that needs human review anyway. The validation step catches errors early.

Skip it for latency-sensitive paths (sub-100ms p50) or simple Q&A where a user can manually fix a bad answer. The overhead isn't worth it.

## The Tradeoff

Mellea extends DSPy rather than replacing it. You keep all of DSPy's features (signatures, modules, compilation) and gain validation on top. The cost is latency and LLM calls. The benefit is higher quality and fewer manual retries.

## Next Steps

Copy the "Your First Validated DSPy Program" example at the top, save it as `validated_program.py`, and run it.

For more, see the [Mellea docs](https://docs.mellea.ai/), [DSPy integration examples](https://github.com/generative-computing/mellea-contribs/tree/main/mellea_contribs/dspy_backend/examples), and the [Mellea Discord](https://ibm.biz/mellea-discord).

This integration lives in [mellea-contribs](https://github.com/generative-computing/mellea-contribs).

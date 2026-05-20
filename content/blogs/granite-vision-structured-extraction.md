---
title: "Getting Structured Data Out of Images with Granite Vision 4.1"
date: "2026-06-03"
author: "Nigel Jones"
excerpt: "Vision models return prose. This post shows how to get a typed Python object back instead, using Mellea's format= parameter and ImageBlock."
tags: ["vision", "structured-output", "granite", "IVR", "image-extraction"]
---

Vision models narrate. Hand one a receipt and you get three paragraphs describing it — and now
you're writing a parser for natural language, which is exactly what you were trying to avoid.

The usual workaround is to append "respond with JSON matching this schema" to your prompt, hope
the model complies, catch the `json.JSONDecodeError` when it doesn't, and wonder why extracting
a number from a picture turned into a reliability project.

There's a cleaner path.

---

> **EDITORIAL NOTE — remove before publishing**
>
> Granite Vision 4.1 is not yet in the Ollama library. The blog is written for Ollama
> (that's the final published form — don't change the code examples). For testing and review,
> run the code against mlx-vlm instead:
>
> ```bash
> pip install mlx-vlm mellea pillow
> python -m mlx_vlm.server --model ibm-granite/granite-vision-4.1-4b
> # Serves at http://localhost:8080/v1 — model downloads (~3 GB) on first run
> ```
>
> Then change the session setup in each code block from:
> `m = start_session(model_id="granite-vision-4.1")`
> to:
> `m = MelleaSession(OpenAIBackend("ibm-granite/granite-vision-4.1-4b", base_url="http://localhost:8080/v1", api_key="mlx"))`
>
> Watch the [Ollama library](https://ollama.com/library) for `granite-vision-4.1`. When it
> lands: delete this note, verify `ollama pull granite-vision-4.1` works, publish.

---

## Running locally

[Granite Vision 4.1](https://huggingface.co/ibm-granite/granite-vision-4.1-4b) runs locally
on Ollama. No API key, no cloud bill:

```bash
ollama pull granite-vision-4.1
uv add mellea pillow
```

## The problem

Here's the receipt we'll work with — a small deli order with a loyalty discount:

![Sample deli receipt](/images/blogs/granite-vision-structured-extraction-receipt.jpg)

Start with the naïve approach: ask the model to describe it.

```python
from mellea import start_session
from mellea.core import ImageBlock
from PIL import Image

m = start_session(model_id="granite-vision-4.1")
img = ImageBlock.from_pil_image(Image.open("receipt.jpg"))

result = m.instruct("What's on this receipt?", images=[img])
print(result)
```

Output:

```text
"This receipt is from Grove Street Deli in Portland, dated March 15th 2026.
 It shows two drip coffees at $3.50 each, an avocado toast for $10.50, and
 a blueberry muffin for $3.95, with a $1.00 loyalty discount applied. The
 subtotal comes to $20.45 with 8.5% tax of $1.74, for a total of $22.19."
```

Readable. Useless as data. You can't do `result.total` or `result.items[0].unit_price`.

## The return type is the extraction schema

Define what you want as a Pydantic model and pass it to `format=`. Mellea uses constrained
decoding to guarantee the output matches — no prompt-engineering the JSON shape, no parse
errors to catch.

```python
from pydantic import BaseModel
from mellea import start_session
from mellea.core import ImageBlock
from PIL import Image


class LineItem(BaseModel):
    description: str
    quantity: int
    unit_price: float


class Receipt(BaseModel):
    vendor: str
    date: str
    items: list[LineItem]
    subtotal: float
    tax: float
    total: float


m = start_session(model_id="granite-vision-4.1")
img = ImageBlock.from_pil_image(Image.open("receipt.jpg"))

result = m.instruct("Extract the receipt data.", images=[img], format=Receipt)
receipt = Receipt.model_validate_json(str(result))

print(receipt.vendor)            # "Grove Street Deli"
print(receipt.total)             # 22.19
print(receipt.items[0].quantity) # 2
```

`ImageBlock.from_pil_image()` converts any PIL image to the base64 PNG the backends expect.
`format=Receipt` switches the model into constrained decoding. `model_validate_json` gives you
a fully typed Python object with IDE autocomplete on every field.

Notice the discount line on the receipt (`unit_price: -1.00`). The model needs to handle
negative values correctly — structured output forces it to produce a proper float, which we
can verify programmatically.

## When the type isn't enough

Pydantic catches structural failures: wrong shape, missing fields, values that can't be coerced.
It won't catch semantic ones. If the model reads the total as `-22.19`, that's valid JSON.
If it parses the date as `"March 15"` instead of `"2026-03-15"`, the field is populated —
it's just wrong.

`requirements=` handles this. Pass plain-English constraints; if the first attempt fails one,
Mellea repairs and retries with the failure reason fed back into the prompt:

```python
from mellea.stdlib.sampling import RejectionSamplingStrategy

result = m.instruct(
    "Extract the receipt data.",
    images=[img],
    format=Receipt,
    requirements=[
        "total must be a positive number",
        "date must be in ISO 8601 format (YYYY-MM-DD)",
        "each item's unit_price must be positive except for discounts",
    ],
    strategy=RejectionSamplingStrategy(loop_budget=3),
)
receipt = Receipt.model_validate_json(str(result))
```

Worth being clear about the limit: requirements validate the *extracted values*, not whether
they match what's physically in the image. A requirement catches the model hallucinating a
negative total; it can't verify the number on screen was $22.19 rather than $21.19. For that
you need an external check.

## When to reach for IVR

If you have a concrete verifiable property — something independent of the image — wire it as a
`validation_fn`. Mellea runs it on each attempt and feeds the failure reason back into the
repair prompt if it fails.

Line-item arithmetic is the natural case here: the items should sum to the subtotal. The
discount makes this a real test — the model has to correctly treat `-$1.00` as negative:

```python
from mellea.stdlib.requirements import req, simple_validate
from mellea.stdlib.sampling import RejectionSamplingStrategy


def check_line_totals(json_str: str) -> tuple[bool, str]:
    r = Receipt.model_validate_json(json_str)
    computed = round(sum(i.quantity * i.unit_price for i in r.items), 2)
    if abs(computed - r.subtotal) > 0.01:
        return False, f"line items sum to ${computed:.2f}, subtotal shows ${r.subtotal:.2f}"
    return True, ""


result = m.instruct(
    "Extract the receipt data.",
    images=[img],
    format=Receipt,
    requirements=[
        "total must be a positive number",
        req("line items match subtotal", validation_fn=simple_validate(check_line_totals)),
    ],
    strategy=RejectionSamplingStrategy(loop_budget=3),
)
receipt = Receipt.model_validate_json(str(result))
```

The general progression: `format=` alone → `requirements=` for semantic constraints →
`validation_fn` when you have something concrete to verify programmatically. Most image
extraction stops at step two. Reach for `validation_fn` when you'd be writing the same check
in post-processing anyway — it belongs in the prompt loop, not after it.

## Swapping backends

`ImageBlock` is backend-agnostic. The only thing that changes is the session setup:

```python
# Ollama (this post)
from mellea import start_session
m = start_session(model_id="granite-vision-4.1")

# Any OpenAI-compatible endpoint (vLLM, mlx-vlm, cloud)
from mellea import MelleaSession
from mellea.backends.openai import OpenAIBackend
m = MelleaSession(OpenAIBackend("ibm-granite/granite-vision-4.1-4b",
                                base_url="http://localhost:8080/v1", api_key="mlx"))
```

The `instruct` call — `images=`, `format=`, `requirements=`, `strategy=` — is identical
across all backends.

## What we covered

- `ImageBlock.from_pil_image()` loads any PIL image for use with vision-capable backends
- `format=` on `m.instruct()` uses constrained decoding to guarantee a valid Pydantic object
  back — no JSON parsing errors to handle
- `requirements=` adds plain-English semantic constraints with automatic repair on failure
- `simple_validate(fn)` wraps a `str → (bool, str)` function into the form `validation_fn=`
  expects, enabling programmatic checks like arithmetic verification
- The whole pipeline — structured output, requirements, IVR — composes with any backend;
  only the session setup changes

**Going further:**

- [Use Images and Vision Models](https://docs.mellea.ai/how-to/use-images-and-vision) —
  image loading, backend configuration, multi-image prompts
- [Enforce Structured Output](https://docs.mellea.ai/how-to/enforce-structured-output) —
  `format=`, `@generative`, and constrained decoding in detail
- [The Requirements System](https://docs.mellea.ai/concepts/requirements-system) —
  how `Requirement`, `ValidationResult`, and `simple_validate` work together
- [Instruct-Validate-Repair](https://docs.mellea.ai/concepts/instruct-validate-repair) —
  the IVR loop, sampling strategies, and repair prompts explained
- [Write Custom Verifiers](https://docs.mellea.ai/how-to/write-custom-verifiers) —
  validation functions beyond simple string checks

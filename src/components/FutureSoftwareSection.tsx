import Link from 'next/link';
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import { siteConfig } from '@/config/site';
import { assetUrl } from '@/lib/assetUrl';

hljs.registerLanguage('python', python);

const TABS = [
  {
    id: 'generative',
    title: 'Generative Functions',
    description:
      'Write a typed Python function, get structured LLM output. Docstrings are prompts, type hints are schemas — no parsers, no chains.',
    learnMoreUrl: siteConfig.docsGenerativeFunctionsUrl,
    code: `from typing import Literal
from pydantic import BaseModel
from mellea import generative, start_session

class ReviewAnalysis(BaseModel):
    sentiment: Literal["positive", "negative", "neutral"]
    score: int    # 1-5
    summary: str  # one sentence

@generative
def analyze_review(text: str) -> ReviewAnalysis:
    """Extract sentiment, a 1-5 score, and a one-sentence summary."""
    ...

m = start_session()
result = analyze_review(m, text="Battery life is great but the screen is dim")

print(result.sentiment)  # "positive", "negative", or "neutral" — always
print(result.score)      # an int, 1-5 — always
print(result.summary)    # a str — always`,
  },
  {
    id: 'instruct',
    title: 'Instruct, Validate, Repair',
    description:
      'Add requirements to any LLM call. Mellea validates outputs and retries automatically — swap between rejection sampling, majority voting, and more with one parameter.',
    learnMoreUrl: siteConfig.docsRequirementsUrl,
    code: `import mellea
from mellea.stdlib.sampling import RejectionSamplingStrategy

def write_email_with_strategy(m: mellea.MelleaSession, name: str, notes: str) -> str:
    email_candidate = m.instruct(
        f"Write an email to {name} using the notes following: {notes}.",
        requirements=[
            "The email should have a salutation.",
            "Use a formal tone.",
        ],
        strategy=RejectionSamplingStrategy(loop_budget=3),
        return_sampling_results=True,
    )

    if email_candidate.success:
        return str(email_candidate.result)

    # If sampling fails, use the first generation
    print("Expect sub-par result.")
    return email_candidate.sample_generations[0].value`,
  },
  {
    id: 'safety',
    title: 'Safety and Guardrails',
    description:
      'Detect harmful outputs, social bias, and jailbreak attempts before they reach your users — using built-in Granite Guardian integration, with no external service required.',
    learnMoreUrl: siteConfig.docsSafetyUrl,
    code: `import mellea
from mellea.stdlib.requirements.safety.guardian import (
    GuardianCheck, GuardianRisk,
)

m = mellea.start_session()

response = m.instruct(
    "Write a helpful customer support response to: "
    "How do I reset my password?",
    requirements=[
        "Be concise and professional.",
        GuardianCheck(GuardianRisk.HARM),
        GuardianCheck(GuardianRisk.SOCIAL_BIAS),
    ],
)

print(response)  # validated — or retried until it passes`,
  },
] as const;

/** Highlighted at build time (Server Component) — ships static HTML, no client-side highlighting. */
function highlight(code: string): string {
  return hljs.highlight(code, { language: 'python' }).value;
}

export default function FutureSoftwareSection() {
  return (
    <section id="future-software-section" className="future-software" aria-labelledby="future-software-heading">
      <div className="future-software__inner">
        <h2 id="future-software-heading" className="future-software__title">
          Here&rsquo;s the future of software
        </h2>

        <div className="future-panel" data-future-panel>
          <div className="future-panel__nav" role="tablist" aria-label="Code examples">
            {TABS.map((tab, index) => (
              <div
                key={tab.id}
                className={`future-panel__tab${index === 0 ? ' is-active' : ''}`}
                role="tab"
                id={`future-tab-${tab.id}`}
                aria-selected={index === 0}
                aria-controls={`future-code-${tab.id}`}
                data-panel={tab.id}
                tabIndex={index === 0 ? 0 : -1}
              >
                <span className="future-panel__tab-title">{tab.title}</span>
                <span className="future-panel__tab-body">
                  <span className="future-panel__tab-desc">{tab.description}</span>
                  <Link
                    href={tab.learnMoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="future-panel__learn-more"
                  >
                    Learn more
                    <span className="btn__icon-mask btn__icon-mask--arrow-up-right" aria-hidden="true" />
                  </Link>
                </span>
              </div>
            ))}
          </div>

          <div className="future-panel__stage">
            <div className="future-panel__code-header">
              <span className="future-panel__code-label">Python</span>
              <button
                type="button"
                className="future-panel__copy"
                data-future-copy="#future-code-generative"
                aria-label="Copy code to clipboard"
              >
                <span className="future-panel__copy-label" hidden>Copied!</span>
                <img className="future-panel__copy-icon" src={assetUrl('/assets/copy.svg')} alt="" width={20} height={20} />
              </button>
            </div>

            <div className="future-panel__code-viewport">
              {TABS.map((tab, index) => (
                <pre
                  key={tab.id}
                  id={`future-code-${tab.id}`}
                  className={`future-panel__code${index === 0 ? ' is-active' : ''}`}
                  role="tabpanel"
                  aria-labelledby={`future-tab-${tab.id}`}
                >
                  <code
                    className="hljs language-python"
                    dangerouslySetInnerHTML={{ __html: highlight(tab.code) }}
                  />
                </pre>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

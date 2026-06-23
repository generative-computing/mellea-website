'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const TABS = [
  {
    id: 'generative',
    title: 'Generative Functions',
    description:
      'Write a typed Python function, get structured LLM output. Docstrings are prompts, type hints are schemas — no parsers, no chains.',
    learnMore: 'https://docs.mellea.ai/concepts/generative-functions',
    code: [
      { type: 'kw', text: 'from' }, { type: '', text: ' typing ' }, { type: 'kw', text: 'import' }, { type: '', text: ' Literal\n' },
      { type: 'kw', text: 'from' }, { type: '', text: ' pydantic ' }, { type: 'kw', text: 'import' }, { type: '', text: ' BaseModel\n' },
      { type: 'kw', text: 'from' }, { type: '', text: ' mellea ' }, { type: 'kw', text: 'import' }, { type: '', text: ' generative, start_session\n\n' },
      { type: 'kw', text: 'class' }, { type: '', text: ' ' }, { type: 'type', text: 'ReviewAnalysis' }, { type: '', text: '(BaseModel):\n' },
      { type: '', text: '    sentiment: Literal[' }, { type: 'str', text: '"positive"' }, { type: '', text: ', ' }, { type: 'str', text: '"negative"' }, { type: '', text: ', ' }, { type: 'str', text: '"neutral"' }, { type: '', text: ']\n' },
      { type: '', text: '    score: ' }, { type: 'type', text: 'int' }, { type: '', text: '    ' }, { type: 'cmt', text: '# 1-5' }, { type: '', text: '\n' },
      { type: '', text: '    summary: ' }, { type: 'type', text: 'str' }, { type: '', text: '  ' }, { type: 'cmt', text: '# one sentence' }, { type: '', text: '\n\n' },
      { type: 'fn', text: '@generative' }, { type: '', text: '\n' },
      { type: 'kw', text: 'def' }, { type: '', text: ' ' }, { type: 'fn', text: 'analyze_review' }, { type: '', text: '(text: ' }, { type: 'type', text: 'str' }, { type: '', text: ') -> ReviewAnalysis:\n' },
      { type: '', text: '    ' }, { type: 'str', text: '"""Extract sentiment, a 1-5 score, and a one-sentence summary."""' }, { type: '', text: '\n' },
      { type: '', text: '    ...\n\n' },
      { type: '', text: 'm = start_session()\n' },
      { type: '', text: 'result = analyze_review(m, text=' }, { type: 'str', text: '"Battery life is great but the screen is dim"' }, { type: '', text: ')\n\n' },
      { type: 'builtin', text: 'print' }, { type: '', text: '(result.sentiment)  ' }, { type: 'cmt', text: '# "positive", "negative", or "neutral" — always' }, { type: '', text: '\n' },
      { type: 'builtin', text: 'print' }, { type: '', text: '(result.score)      ' }, { type: 'cmt', text: '# an int, 1-5 — always' }, { type: '', text: '\n' },
      { type: 'builtin', text: 'print' }, { type: '', text: '(result.summary)    ' }, { type: 'cmt', text: '# a str — always' },
    ],
    plainCode: `from typing import Literal
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
    learnMore: 'https://docs.mellea.ai/concepts/instruct-validate-repair',
    code: [
      { type: 'kw', text: 'import' }, { type: '', text: ' mellea\n' },
      { type: 'kw', text: 'from' }, { type: '', text: ' mellea.stdlib.sampling ' }, { type: 'kw', text: 'import' }, { type: '', text: ' RejectionSamplingStrategy\n\n' },
      { type: 'kw', text: 'def' }, { type: '', text: ' ' }, { type: 'fn', text: 'write_email_with_strategy' }, { type: '', text: '(m: mellea.MelleaSession, name: ' }, { type: 'type', text: 'str' }, { type: '', text: ', notes: ' }, { type: 'type', text: 'str' }, { type: '', text: ') -> ' }, { type: 'type', text: 'str' }, { type: '', text: ':\n' },
      { type: '', text: '    email_candidate = m.instruct(\n' },
      { type: '', text: '        ' }, { type: 'str', text: 'f"Write an email to {name} using the notes following: {notes}."' }, { type: '', text: ',\n' },
      { type: '', text: '        requirements=[\n' },
      { type: '', text: '            ' }, { type: 'str', text: '"The email should have a salutation."' }, { type: '', text: ',\n' },
      { type: '', text: '            ' }, { type: 'str', text: '"Use a formal tone."' }, { type: '', text: ',\n' },
      { type: '', text: '        ],\n' },
      { type: '', text: '        strategy=RejectionSamplingStrategy(loop_budget=' }, { type: 'num', text: '3' }, { type: '', text: '),\n' },
      { type: '', text: '        return_sampling_results=' }, { type: 'kw', text: 'True' }, { type: '', text: ',\n    )\n\n' },
      { type: '', text: '    ' }, { type: 'kw', text: 'if' }, { type: '', text: ' email_candidate.success:\n' },
      { type: '', text: '        ' }, { type: 'kw', text: 'return' }, { type: '', text: ' ' }, { type: 'type', text: 'str' }, { type: '', text: '(email_candidate.result)\n\n' },
      { type: '', text: '    ' }, { type: 'cmt', text: '# If sampling fails, use the first generation' }, { type: '', text: '\n' },
      { type: '', text: '    ' }, { type: 'builtin', text: 'print' }, { type: '', text: '(' }, { type: 'str', text: '"Expect sub-par result."' }, { type: '', text: ')\n' },
      { type: '', text: '    ' }, { type: 'kw', text: 'return' }, { type: '', text: ' email_candidate.sample_generations[' }, { type: 'num', text: '0' }, { type: '', text: '].value' },
    ],
    plainCode: `import mellea
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
    learnMore: 'https://docs.mellea.ai/how-to/safety-guardrails',
    code: [
      { type: 'kw', text: 'import' }, { type: '', text: ' mellea\n' },
      { type: 'kw', text: 'from' }, { type: '', text: ' mellea.stdlib.requirements.safety.guardian ' }, { type: 'kw', text: 'import' }, { type: '', text: ' (\n    GuardianCheck, GuardianRisk,\n)\n\n' },
      { type: '', text: 'm = mellea.start_session()\n\n' },
      { type: '', text: 'response = m.instruct(\n' },
      { type: '', text: '    ' }, { type: 'str', text: '"Write a helpful customer support response to: "' }, { type: '', text: '\n' },
      { type: '', text: '    ' }, { type: 'str', text: '"How do I reset my password?"' }, { type: '', text: ',\n' },
      { type: '', text: '    requirements=[\n' },
      { type: '', text: '        ' }, { type: 'str', text: '"Be concise and professional."' }, { type: '', text: ',\n' },
      { type: '', text: '        GuardianCheck(GuardianRisk.HARM),\n' },
      { type: '', text: '        GuardianCheck(GuardianRisk.SOCIAL_BIAS),\n' },
      { type: '', text: '    ],\n)\n\n' },
      { type: 'builtin', text: 'print' }, { type: '', text: '(response)  ' }, { type: 'cmt', text: '# validated — or retried until it passes' },
    ],
    plainCode: `import mellea
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
];

export default function FutureSoftwarePanel() {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(TABS[active].plainCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(i + 1, TABS.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(i - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(TABS.length - 1);
    }
  }

  return (
    <div className="future-panel" data-future-panel>
      <div className="future-panel__nav" role="tablist" aria-label="Code examples">
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            type="button"
            className={`future-panel__tab${active === i ? ' is-active' : ''}`}
            role="tab"
            aria-selected={active === i}
            aria-controls={`future-code-${tab.id}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
          >
            <span className="future-panel__tab-title">{tab.title}</span>
            <span className="future-panel__tab-body">
              <span className="future-panel__tab-desc">{tab.description}</span>
              <Link
                href={tab.learnMore}
                target="_blank"
                rel="noopener noreferrer"
                className="future-panel__learn-more"
                onClick={(e) => e.stopPropagation()}
              >
                Learn more
                <Image
                  src={`${basePath}/images/icon-arrow-up-right.svg`}
                  alt=""
                  width={20}
                  height={20}
                  unoptimized
                />
              </Link>
            </span>
          </button>
        ))}
      </div>

      <div className="future-panel__stage">
        <div className="future-panel__code-header">
          <span className="future-panel__code-label">Python</span>
          <button
            type="button"
            className={`future-panel__copy${copied ? ' future-panel__copy--copied' : ''}`}
            onClick={copy}
            aria-label="Copy code to clipboard"
          >
            {copied ? (
              <span>Copied!</span>
            ) : (
              <Image
                className="future-panel__copy-icon"
                src={`${basePath}/images/copy.svg`}
                alt=""
                width={20}
                height={20}
                unoptimized
              />
            )}
          </button>
        </div>

        <div className="future-panel__code-viewport">
          {TABS.map((tab, i) => (
            <pre
              key={tab.id}
              id={`future-code-${tab.id}`}
              className={`future-panel__code${active === i ? ' is-active' : ''}`}
              role="tabpanel"
              aria-labelledby={`future-tab-${tab.id}`}
              tabIndex={0}
              hidden={active !== i}
            >
              <code>
                {tab.code.map((token, j) =>
                  token.type ? (
                    <span key={j} className={`code-${token.type}`}>{token.text}</span>
                  ) : (
                    <span key={j}>{token.text}</span>
                  )
                )}
              </code>
            </pre>
          ))}
        </div>
      </div>
    </div>
  );
}

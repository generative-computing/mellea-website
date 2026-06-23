'use client';

import Image from 'next/image';
import TypewriterText from './TypewriterText';
import ScrollReveal from './ScrollReveal';
import MelleaCompare from './MelleaCompare';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const FEATURE_CARDS = [
  {
    icon: 'Logo--python.svg',
    title: 'Precise',
    text: 'Write generative functions using code. The @generative decorator handles the communication with the LLM.',
  },
  {
    icon: 'Document--requirements.svg',
    title: 'Predictable',
    text: 'Set the requirements that you want Mellea to validate. Automatic retries means unwanted outputs never reach your users.',
  },
  {
    icon: 'adapter-notification.svg',
    title: 'Flexible',
    text: 'Expose any Mellea program as an MCP tool. The calling agent gets the same validated, predictable output as other Mellea users.',
  },
  {
    icon: 'IBM-security.svg',
    title: 'Safe',
    text: 'Built-in Granite Guardian integration detects harmful outputs, hallucinations, and jailbreak attempts before they reach your users — no external service required.',
  },
];

export default function HowMelleaSection() {
  return (
    <section className="how-mellea" id="how-mellea-section" aria-labelledby="how-mellea-heading">
      <div className="how-mellea__inner">
        <MelleaCompare />

        <div className="how-mellea__intro">
          <div className="how-mellea__copy">
            <h2 id="how-mellea-heading" className="how-mellea__title" aria-label="Write python functions that call LLMs">
              <TypewriterText
                text="Write python functions that call LLMs"
                triggerOnScroll
                threshold={0.18}
                typingSpeed={48}
              />
            </h2>
            <ScrollReveal className="how-mellea__text">
              <p className="how-mellea__lead">
                Mellea is a Python library for working with LLMs using generative functions.
              </p>
              <p className="how-mellea__lead">
                In traditional programming, functions turn inputs into deterministic outputs. Mellea builds on this by allowing functions to call LLMs to create an output, but with customizable requirements that maintain the rigor of professional software development. If an LLM returns something that doesn&apos;t meet a requirement, Mellea will automatically try it again. This means you can build applications that make use of the power of LLMs while keeping all the benefits of reliable, testable Python code.
              </p>
            </ScrollReveal>
          </div>
          <div className="how-mellea__visual">
            <Image
              className="how-mellea__flowchart"
              src={`${basePath}/images/chart.svg`}
              alt="Flowchart: input passes through a Python function and LLM call, requirements are checked, and failed outputs retry until a reliable result is returned"
              width={563}
              height={408}
              unoptimized
            />
          </div>
        </div>

        <ScrollReveal stagger={0.06} className="how-mellea__cards">
          {FEATURE_CARDS.map((card) => (
            <article key={card.title} className="feature-card">
              <Image
                className="feature-card__icon"
                src={`${basePath}/images/${card.icon}`}
                alt=""
                width={24}
                height={24}
                unoptimized
              />
              <h3 className="feature-card__title">{card.title}</h3>
              <p className="feature-card__text">{card.text}</p>
            </article>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}

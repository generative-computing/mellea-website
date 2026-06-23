'use client';

import Image from 'next/image';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import TypewriterText from './TypewriterText';
import ScrollReveal from './ScrollReveal';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function GraniteSection() {
  return (
    <section className="granite" id="granite-section" aria-labelledby="granite-heading">
      <div className="granite__inner">
        <div className="granite__intro">
          <h2 id="granite-heading" className="granite__title" aria-label="Mellea + Granite">
            <TypewriterText
              text="Mellea + Granite"
              triggerOnScroll
              threshold={0.18}
              typingSpeed={60}
            />
          </h2>
          <ScrollReveal>
            <p className="granite__lead">
              Granite is a family of models built with enterprises in mind. It has open-weights for transparency, comes in sizes from 350M-32B parameters, and offers an extensive adapter library. This means it can take on specific tasks with the performance of a much larger model while keeping its nimble speed and low costs.
            </p>
          </ScrollReveal>
        </div>

        <ScrollReveal>
          <div className="granite__card">
            <h3 className="granite__card-title">
              Mellea and Granite bring out the best in each other.
            </h3>
            <p className="granite__card-text">
              Mellea is designed to be Granite&apos;s SDK. Together, they offer a flexible way to build AI applications that are transparent from the ground up and only do what you want them to.
            </p>
            <div className="granite__actions">
              <Link
                className="btn btn-primary"
                href={siteConfig.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Explore Granite models
                <Image
                  src={`${basePath}/images/icon-arrow-up-right.svg`}
                  alt=""
                  width={20}
                  height={20}
                  unoptimized
                />
              </Link>
              <Link
                className="btn btn-ghost"
                href={siteConfig.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Browse demos
                <Image
                  src={`${basePath}/images/icon-arrow-up-right.svg`}
                  alt=""
                  width={20}
                  height={20}
                  unoptimized
                />
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

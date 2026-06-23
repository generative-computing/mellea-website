'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import TypewriterText from './TypewriterText';
import DotField from './DotField';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function HeroSection() {
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyInstall() {
    navigator.clipboard.writeText('pip install mellea').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <section className="hero" aria-label="Hero">
      <div className="hero__dot-field" id="hero-dot-field" aria-hidden="true">
        <DotField />
      </div>
      <div className="hero__content">
        <h1 className="hero__title" aria-label="Control LLMs with code, not prompts">
          <TypewriterText
            text={'Control LLMs with\ncode, not prompts'}
            typingSpeed={20}
            onComplete={() => setSubtitleVisible(true)}
          />
        </h1>

        <p
          className={`hero__subtitle${!subtitleVisible ? ' hero__subtitle--pending' : ''}`}
          style={subtitleVisible ? { opacity: 1, transform: 'none', transition: 'opacity 0.85s ease, transform 0.85s ease' } : undefined}
        >
          Make outputs precise, predictable, and repeatable with Mellea&apos;s library of generative functions.
        </p>

        <div className="hero__actions">
          <button
            type="button"
            className={`btn btn-ghost btn-pip-install${copied ? ' btn-pip-install--copied' : ''}`}
            onClick={copyInstall}
            aria-label="Copy pip install mellea to clipboard"
          >
            <span className="btn-pip-install__label">
              <span className="btn-pip-install__label-text">
                {copied ? 'Copied!' : 'pip install mellea'}
              </span>
            </span>
            <Image
              src={`${basePath}/images/copy.svg`}
              alt=""
              width={20}
              height={20}
              unoptimized
            />
          </button>
          <Link
            className="btn btn-primary"
            href={siteConfig.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get started
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
    </section>
  );
}

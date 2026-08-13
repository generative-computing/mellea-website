import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { assetUrl } from '@/lib/assetUrl';

export default function HeroSection() {
  return (
    <main id="main-content" className="hero">
      <div className="hero__dot-field" id="hero-dot-field" aria-hidden="true" />
      <div className="hero__content">
        <h1 className="hero__title" aria-label="Control LLMs with code, not prompts">
          <span
            id="hero-title-type"
            className="text-type"
            data-text={'Control LLMs with\ncode, not prompts'}
          >
            <span className="text-type__content" />
            <span className="text-type__cursor" aria-hidden="true" />
          </span>
        </h1>
        <p className="hero__subtitle hero__subtitle--pending" id="hero-subtitle">
          Make outputs precise, predictable, and repeatable with Mellea&rsquo;s library
          of generative functions.
        </p>

        <div className="hero__actions">
          <button
            type="button"
            className="btn btn-secondary btn-pip-install"
            data-copy-text="pip install mellea"
            aria-label="Copy pip install mellea to clipboard"
          >
            <span className="btn-pip-install__label">
              <span className="btn-pip-install__label-text">pip install mellea</span>
            </span>
            <img className="btn__icon" src={assetUrl('/assets/copy.svg')} alt="" width={20} height={20} />
          </button>
          <Link className="btn btn-primary get-started-btn" href={siteConfig.docsUrl} target="_blank" rel="noopener noreferrer">
            <span>Get started</span>
            <span className="btn__icon-mask btn__icon-mask--arrow-up-right" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  );
}

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { siteConfig } from '@/config/site';
import TypewriterText from './TypewriterText';
import ScrollReveal from './ScrollReveal';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function Footer() {
  return (
    <footer className="site-footer" id="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__cta">
          <h2 className="site-footer__headline" aria-label="Mellea is for developers who'd rather write code than vibes.">
            <TypewriterText
              text={"Mellea is for developers who'd rather write code than vibes."}
              triggerOnScroll
              threshold={0.15}
              typingSpeed={15}
            />
          </h2>
          <ScrollReveal>
            <p className="site-footer__subtitle">
              Join us in building the future of software development.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <div className="site-footer__actions">
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
              <Link
                className="btn btn-secondary site-footer__github-btn"
                href={siteConfig.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Github
                <Image
                  src={`${basePath}/images/icon-arrow-up-right.svg`}
                  alt=""
                  width={20}
                  height={20}
                  unoptimized
                />
              </Link>
            </div>
          </ScrollReveal>
        </div>

        <div className="site-footer__legal">
          <p className="site-footer__copyright">
            &copy; {new Date().getFullYear()}&nbsp;Mellea &middot; Documentation distributed under CC BY 4.0 &middot; IBM &#x1F499; Open Source AI
          </p>
          <nav className="site-footer__links" aria-label="Legal and resources">
            <Link className="site-footer__link" href={siteConfig.githubUrl + '/blob/main/LICENSE'} target="_blank" rel="noopener noreferrer">
              Apache 2.0 License
            </Link>
            <Link className="site-footer__link" href={siteConfig.githubUrl + '/blob/main/CONTRIBUTING.md'} target="_blank" rel="noopener noreferrer">
              Contributing Guide
            </Link>
            <Link className="site-footer__link" href={siteConfig.githubUrl + '/blob/main/CODE_OF_CONDUCT.md'} target="_blank" rel="noopener noreferrer">
              Code of Conduct
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

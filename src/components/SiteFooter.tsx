import Link from 'next/link';
import { siteConfig } from '@/config/site';

interface SiteFooterProps {
  /** Homepage-only closing CTA block (headline, subtitle, Get started / GitHub). */
  showCta?: boolean;
}

export default function SiteFooter({ showCta = false }: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      id="site-footer"
      className={`site-footer${showCta ? '' : ' site-footer--compact'}`}
      aria-labelledby={showCta ? 'footer-heading' : undefined}
    >
      <div className="site-footer__inner">
        {showCta && (
          <div className="site-footer__cta">
            <h2
              id="footer-heading"
              className="site-footer__headline"
              aria-label="Mellea is for developers who'd rather write code than vibes"
            >
              <span
                className="text-type"
                data-text={"Mellea is for developers who'd rather write code than\u00a0vibes."}
              >
                <span className="text-type__content" />
                <span className="text-type__cursor" aria-hidden="true" />
              </span>
            </h2>
            <p id="footer-subtitle" className="site-footer__subtitle">
              Join us in building the future of software development.
            </p>
            <div className="site-footer__actions">
              <Link className="btn btn-primary get-started-btn" href={siteConfig.docsUrl} target="_blank" rel="noopener noreferrer">
                <span>Get started</span>
                <span className="btn__icon-mask btn__icon-mask--arrow-up-right" aria-hidden="true" />
              </Link>
              <Link
                className="btn btn-secondary site-footer__github-btn"
                href={siteConfig.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>View on Github</span>
                <span className="btn__icon-mask btn__icon-mask--arrow-up-right" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}

        <div className="site-footer__legal">
          <p className="site-footer__copyright">
            &copy; {year}{" "}Mellea &middot; Documentation distributed under CC by 4.0 &middot; IBM 💙 Open Source AI
          </p>
          <nav className="site-footer__links" aria-label="Legal and resources">
            <Link className="site-footer__link" href={siteConfig.licenseUrl} target="_blank" rel="noopener noreferrer">
              Apache 2.0 License
            </Link>
            <Link className="site-footer__link" href={siteConfig.contributingUrl} target="_blank" rel="noopener noreferrer">
              Contributing Guide
            </Link>
            <Link className="site-footer__link" href={siteConfig.codeOfConductUrl} target="_blank" rel="noopener noreferrer">
              Code of Conduct
            </Link>
            <Link className="site-footer__link" href={siteConfig.ibmPrivacyUrl} target="_blank" rel="noopener noreferrer">
              IBM Privacy
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

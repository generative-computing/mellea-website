import Link from 'next/link';
import { siteConfig } from '@/config/site';

export default function GraniteSection() {
  return (
    <section id="granite-section" className="granite" aria-labelledby="granite-heading">
      <div className="granite__inner">
        <div className="granite__intro">
          <h2 id="granite-heading" className="granite__title" aria-label="Mellea + Granite">
            <span className="text-type" data-text="Mellea + Granite">
              <span className="text-type__content" />
              <span className="text-type__cursor" aria-hidden="true" />
            </span>
          </h2>
          <p className="granite__lead">
            Granite is a family of models built with enterprises in mind. It has
            open-weights for transparency, comes in sizes from 350M-32B
            parameters, and offers an extensive adapter library. This means it
            can take on specific tasks with the performance of a much larger
            model while keeping its nimble speed and low costs.
          </p>
        </div>

        <div className="granite__card">
          <h3 className="granite__card-title">
            Mellea and Granite bring out the best in each other.
          </h3>
          <p className="granite__card-text">
            Mellea is designed to be Granite&rsquo;s SDK. Together, they offer a
            flexible way to build AI applications that are transparent from the
            ground up and only do what you want them to.
          </p>
          <div className="granite__actions">
            <Link
              className="btn btn-primary granite__cta"
              href={siteConfig.graniteModelsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Explore Granite models</span>
              <span className="btn__icon-mask btn__icon-mask--arrow-up-right" aria-hidden="true" />
            </Link>
            <Link
              className="btn btn-ghost granite__cta-secondary"
              href={siteConfig.graniteDemosUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Browse demos</span>
              <span className="btn__icon-mask btn__icon-mask--arrow-up-right" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

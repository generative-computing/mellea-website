import { assetUrl } from '@/lib/assetUrl';

export default function HowMelleaSection() {
  return (
    <section id="how-mellea-section" className="how-mellea" aria-labelledby="how-mellea-heading">
      <div className="how-mellea__inner">
        <div className="how-mellea__compare" data-mellea-compare>
          <div className="how-mellea__compare-inner">
            <span className="how-mellea__compare-label how-mellea__compare-label--without">
              without mellea
            </span>
            <span className="how-mellea__compare-label how-mellea__compare-label--with">
              with mellea
            </span>

            <div className="how-mellea__compare-stage">
              <div className="how-mellea__compare-frame" data-compare-frame>
                <img
                  className="how-mellea__compare-image how-mellea__compare-image--with"
                  src={assetUrl('/assets/how-mellea-with.svg')}
                  alt=""
                  width={866}
                  height={645}
                  decoding="async"
                />
                <div className="how-mellea__compare-clip">
                  <img
                    className="how-mellea__compare-image how-mellea__compare-image--without"
                    src={assetUrl('/assets/how-mellea-without.svg')}
                    alt=""
                    width={866}
                    height={645}
                    decoding="async"
                  />
                </div>

                <div className="how-mellea__compare-divider" data-compare-divider>
                  <button
                    className="how-mellea__compare-handle"
                    type="button"
                    data-compare-handle
                    role="slider"
                    aria-label="Compare code without and with Mellea"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={44}
                  >
                    <img
                      className="how-mellea__compare-handle-icon"
                      src={assetUrl('/assets/how-mellea-slider-icon.svg')}
                      alt=""
                      width={24}
                      height={24}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="how-mellea__intro">
          <div className="how-mellea__copy">
            <h2
              id="how-mellea-heading"
              className="granite__title"
              aria-label="Write python functions that call LLMs"
            >
              <span className="text-type" data-text={'Write python functions that\ncall LLMs'}>
                <span className="text-type__content" />
                <span className="text-type__cursor" aria-hidden="true" />
              </span>
            </h2>
            <div className="how-mellea__text">
              <p className="granite__lead">
                Mellea is a Python library for working with LLMs using generative
                functions.
              </p>
              <p className="granite__lead">
                In traditional programming, functions turn inputs into
                deterministic outputs. Mellea builds on this by allowing functions
                to call LLMs to create an output, but with customizable
                requirements that maintain the rigor of professional software
                development. If an LLM returns something that doesn&rsquo;t meet a
                requirement, Mellea will automatically try it again. This means
                you can build applications that make use of the power of LLMs
                while keeping all the benefits of reliable, testable Python code.
              </p>
            </div>
          </div>
          <div className="how-mellea__visual">
            <img
              className="how-mellea__flowchart"
              src={assetUrl('/assets/chart.svg')}
              alt="Flowchart: input passes through a Python function and LLM call, requirements are checked, and failed outputs retry until a reliable result is returned"
              width={563}
              height={408}
              decoding="async"
            />
          </div>
        </div>

        <div className="how-mellea__cards">
          <article className="feature-card">
            <img className="feature-card__icon" src={assetUrl('/assets/Logo--python.svg')} alt="" width={24} height={24} />
            <h3 className="feature-card__title">Precise</h3>
            <p className="feature-card__text">
              Write generative functions using code. The @generative decorator
              handles the communication with the LLM.
            </p>
          </article>
          <article className="feature-card">
            <img className="feature-card__icon" src={assetUrl('/assets/Document--requirements.svg')} alt="" width={24} height={24} />
            <h3 className="feature-card__title">Predictable</h3>
            <p className="feature-card__text">
              Set the requirements that you want Mellea to validate. Automatic
              retries mean unwanted outputs never reach your users.
            </p>
          </article>
          <article className="feature-card">
            <img className="feature-card__icon" src={assetUrl('/assets/adapter-notification.svg')} alt="" width={24} height={24} />
            <h3 className="feature-card__title">Flexible</h3>
            <p className="feature-card__text">
              Expose any Mellea program as an MCP tool. The calling agent gets
              the same validated, predictable output as other Mellea users.
            </p>
          </article>
          <article className="feature-card">
            <img className="feature-card__icon" src={assetUrl('/assets/IBM-security.svg')} alt="" width={24} height={24} />
            <h3 className="feature-card__title">Safe</h3>
            <p className="feature-card__text">
              Built-in Granite Guardian integration detects harmful outputs,
              hallucinations, and jailbreak attempts before they reach your
              users — no external service required.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

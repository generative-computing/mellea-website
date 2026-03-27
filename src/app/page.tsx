import Image from 'next/image';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import BlogCard from '@/components/BlogCard';
import GitHubStats from '@/components/GitHubStats';
import ImageCompare from '@/components/ImageCompare';
import InstallCommand from '@/components/InstallCommand';
import CodeShowcase from '@/components/CodeShowcase';
import { getAllBlogs } from '@/lib/blogs';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function HomePage() {
  const blogs = getAllBlogs();
  const recent = blogs.slice(0, 3);

  return (
    <>
      {/* ── Hero ── */}
      <section className="hero">
        <div className="container">
          <div className="hero-inner">
            <div className="hero-text">
              <p className="hero-eyebrow">Open Source · Apache 2.0</p>

              <h1 className="hero-title">
                Mellea<br />
                <span className="highlight">build predictable AI without guesswork</span>
              </h1>

              <p className="hero-subtitle">
                Inside every AI-powered pipeline, workflow, or script, the unreliable part is the same:
                the LLM call itself. Silent failures, untestable outputs.
                Mellea lets you test and reason about every LLM call using type-annotated outputs, verifiable requirements, and automatic retries.
              </p>

              <InstallCommand />

              <GitHubStats />
            </div>

            <div className="hero-logo">
              <Image
                src={`${basePath}/images/mellea-logo.svg`}
                alt="Mellea logo"
                width={420}
                height={420}
                unoptimized
                priority
              />
            </div>
          </div>

          <div className="feature-strip">
            <div className="feature-item">
              <span className="feature-number">Unit</span>
              <span className="feature-label">testable</span>
            </div>
            <div className="feature-item">
              <span className="feature-number">100%</span>
              <span className="feature-label">Open source</span>
            </div>
            <div className="feature-item">
              <span className="feature-number">Typed</span>
              <span className="feature-label">constrained output</span>
            </div>
            <div className="feature-item">
              <span className="feature-number">Any</span>
              <span className="feature-label">LLM provider</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="section how-it-works">
        <div className="container">
          <div className="section-header">
            <div>
              <p className="section-label">Overview</p>
              <h2 className="section-title">How it works</h2>
            </div>
          </div>

          <div className="how-it-works-body">
            <p className="how-it-works-description">
              Structured, testable Python for every LLM call — no more flaky agents or brittle prompts.
              Mellea lets you instruct LLMs, validate outputs against your requirements,
              and recover from failures automatically. Works across{' '}
              <span className="how-it-works-providers">
                OpenAI, Ollama, vLLM, HuggingFace, Watsonx, LiteLLM, and Bedrock.
              </span>
            </p>

            <ImageCompare />
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              {/* Python logo */}
              <svg className="feature-card-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.007 2.752h5.814v.826H3.9S0 5.789 0 11.969c0 6.18 3.403 5.96 3.403 5.96h2.031v-2.867s-.109-3.402 3.35-3.402h5.766s3.24.052 3.24-3.131V3.19S18.304 0 11.914 0zm-3.2 1.84a1.046 1.046 0 1 1 0 2.092 1.046 1.046 0 0 1 0-2.092z" fill="currentColor"/>
                <path d="M12.086 24c6.094 0 5.714-2.656 5.714-2.656l-.007-2.752H12v-.826h8.121S24 18.211 24 12.031c0-6.18-3.403-5.96-3.403-5.96h-2.031v2.867s.109 3.402-3.35 3.402H9.45s-3.24-.052-3.24 3.131v5.309S5.696 24 12.086 24zm3.2-1.84a1.046 1.046 0 1 1 0-2.092 1.046 1.046 0 0 1 0 2.092z" fill="currentColor"/>
              </svg>
              <h3 className="feature-card-title">Python not Prose</h3>
              <p className="feature-card-body">The <code>@generative</code> decorator turns typed function signatures into LLM specifications. Docstrings are prompts, type hints are schemas — no templates, no parsers.</p>
              <Link href="https://docs.mellea.ai/concepts/generative-functions" target="_blank" className="feature-card-link">Learn more →</Link>
            </div>
            <div className="feature-card">
              {/* Lock / constrained */}
              <svg className="feature-card-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="11" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.75"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                <circle cx="12" cy="17" r="1.5" fill="currentColor"/>
              </svg>
              <h3 className="feature-card-title">Constrained Decoding</h3>
              <p className="feature-card-body">Grammar-constrained generation for Ollama, vLLM, and HuggingFace. Unlike Instructor and PydanticAI, valid output is enforced at the token level — not retried into existence.</p>
              <Link href="https://docs.mellea.ai/how-to/enforce-structured-output" target="_blank" className="feature-card-link">Learn more →</Link>
            </div>
            <div className="feature-card">
              {/* Clipboard checklist */}
              <svg className="feature-card-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.75"/>
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 17h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
              <h3 className="feature-card-title">Requirements Driven</h3>
              <p className="feature-card-body">Declare rules — tone, length, content, custom logic — and Mellea validates every output before it leaves. Automatic retries mean bad output never reaches your users.</p>
              <Link href="https://docs.mellea.ai/concepts/requirements-system" target="_blank" className="feature-card-link">Learn more →</Link>
            </div>
            <div className="feature-card">
              {/* Shield */}
              <svg className="feature-card-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"/>
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h3 className="feature-card-title">Predictable and Resilient</h3>
              <p className="feature-card-body">Need higher confidence? Switch from single-shot to majority voting or best-of-n with one parameter. No code rewrites, no new infrastructure.</p>
              <Link href="https://docs.mellea.ai/advanced/inference-time-scaling" target="_blank" className="feature-card-link">Learn more →</Link>
            </div>
            <div className="feature-card">
              {/* Plug / connector */}
              <svg className="feature-card-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22v-3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                <path d="M8 19h8a2 2 0 0 0 2-2v-2H6v2a2 2 0 0 0 2 2z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"/>
                <path d="M6 15V9l6-7 6 7v6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 9v3M15 9v3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
              <h3 className="feature-card-title">MCP Compatible</h3>
              <p className="feature-card-body">Expose any Mellea program as an MCP tool. The calling agent gets validated output — requirements checked, retries run — not raw LLM responses.</p>
              <Link href="https://docs.mellea.ai/integrations/mcp" target="_blank" className="feature-card-link">Learn more →</Link>
            </div>
            <div className="feature-card">
              {/* Shield with eye — safety */}
              <svg className="feature-card-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="2" fill="currentColor"/>
                <path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
              <h3 className="feature-card-title">Safety &amp; Guardrails</h3>
              <p className="feature-card-body">Built-in Granite Guardian integration detects harmful outputs, hallucinations, and jailbreak attempts before they reach your users — no external service required.</p>
              <Link href="https://docs.mellea.ai/how-to/safety-guardrails" target="_blank" className="feature-card-link">Learn more →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── See it in action ── */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <div>
              <p className="section-label">Examples</p>
              <h2 className="section-title">See it in action</h2>
            </div>
          </div>
          <CodeShowcase />
        </div>
      </section>

      {/* ── Recent Blogs ── */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <div>
              <p className="section-label">Latest Posts</p>
              <h2 className="section-title">From the blog</h2>
            </div>
            <Link href="/blogs" className="section-link">
              All posts →
            </Link>
          </div>

          <div className="blog-grid">
            {recent.map((blog) => (
              <BlogCard key={blog.slug} blog={blog} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Vision / closing CTA ── */}
      <section className="section vision-section">
        <div className="container">
          <div className="vision-inner">
            <p className="vision-text">
              The next era of software requires moving past &ldquo;agent soup&rdquo; and opaque prompting.
              Mellea brings the rigor of traditional software engineering to generative AI &mdash;
              decomposed, verifiable, composable tasks that you can test, debug, and trust.
            </p>
            <div className="vision-actions">
              <Link href={siteConfig.docsUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                Get Started →
              </Link>
              <Link href={siteConfig.githubUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                View on GitHub
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

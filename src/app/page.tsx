import Image from 'next/image';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import BlogCard from '@/components/BlogCard';
import FutureSoftwarePanel from '@/components/FutureSoftwarePanel';
import HeroSection from '@/components/HeroSection';
import HowMelleaSection from '@/components/HowMelleaSection';
import GraniteSection from '@/components/GraniteSection';
import { getAllBlogs } from '@/lib/blogs';
import ScrollReveal from '@/components/ScrollReveal';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function HomePage() {
  const blogs = getAllBlogs();
  const recent = blogs.slice(0, 4);

  return (
    <>
      <HeroSection />
      <HowMelleaSection />

      {/* ── Future Software (code panel) ── */}
      <section className="future-software" aria-labelledby="future-software-heading">
        <div className="future-software__inner">
          <h2 id="future-software-heading" className="future-software__title">
            Here&rsquo;s the future of software
          </h2>
          <FutureSoftwarePanel />
        </div>
      </section>

      <GraniteSection />

      {/* ── Blog section ── */}
      <section className="blog-section" aria-labelledby="blog-heading">
        <div className="blog-section__inner">
          <header className="blog-section__header">
            <h2 id="blog-heading" className="blog-section__title">From the blog</h2>
            <Link className="blog-section__all-posts" href="/blogs">
              <span>All posts</span>
              <Image
                src={`${basePath}/images/icon-arrow-right.svg`}
                alt=""
                width={20}
                height={20}
                unoptimized
              />
            </Link>
          </header>
          <ScrollReveal stagger={0.1} className="blog-section__grid">
            {recent.map((blog) => (
              <BlogCard key={blog.slug} blog={blog} />
            ))}
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}

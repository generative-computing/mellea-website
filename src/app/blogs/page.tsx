import type { Metadata } from 'next';
import { getAllBlogs } from '@/lib/blogs';
import PageShell from '@/components/PageShell';
import BlogCard from '@/components/BlogCard';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Deep-dives on agentic systems, generative computing, and the ideas behind Mellea.',
  alternates: {
    canonical: '/blogs/',
  },
};

export default function BlogsPage() {
  const blogs = getAllBlogs();

  return (
    <PageShell>
      <section className="blog-page" aria-labelledby="blog-page-heading">
        <div className="blog-page__inner">
          <header className="blog-page__header">
            <h1 id="blog-page-heading" className="blog-page__title">Blog</h1>
            <p className="blog-page__subtitle">
              Deep-dives on agentic systems, generative computing, and the ideas behind Mellea.
            </p>
          </header>
          <div className="blog-section__grid blog-page__grid">
            {blogs.map((blog) => (
              <BlogCard key={blog.slug} blog={blog} />
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}

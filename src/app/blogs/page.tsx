import type { Metadata } from 'next';
import BlogCard from '@/components/BlogCard';
import { getAllBlogs } from '@/lib/blogs';

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
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Blog</h1>
        <p className="page-subtitle">
          Deep-dives on agentic systems, generative computing, and the ideas behind Mellea.
        </p>
      </div>

      <div className="blog-grid">
        {blogs.map((blog) => (
          <BlogCard key={blog.slug} blog={blog} />
        ))}
      </div>
    </div>
  );
}

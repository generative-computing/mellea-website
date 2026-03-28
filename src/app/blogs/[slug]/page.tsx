import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { getBlog, getAllBlogSlugs } from '@/lib/blogs';
import { siteConfig } from '@/config/site';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const blog = getBlog(slug);
  if (!blog) return {};
  return {
    title: blog.title,
    description: blog.excerpt,
    openGraph: {
      type: 'article',
      title: blog.title,
      description: blog.excerpt,
      url: `${siteConfig.url}/blogs/${slug}`,
      siteName: siteConfig.name,
      publishedTime: blog.date,
      authors: [blog.author],
      ...(blog.coverImage ? { images: [{ url: blog.coverImage }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: blog.title,
      description: blog.excerpt,
    },
    alternates: {
      canonical: `/blogs/${slug}/`,
    },
  };
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export async function generateStaticParams() {
  const slugs = getAllBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const blog = getBlog(slug);
  if (!blog) notFound();

  return (
    <div className="container">
      <Link href="/blogs" className="back-link">
        ← Back to all posts
      </Link>

      <article className="blog-post">
        <header className="blog-post-header">
          <div className="blog-post-eyebrow">
            <span>{formatDate(blog.date)}</span>
            <span>·</span>
            <span>{blog.author}</span>
          </div>

          <h1 className="blog-post-title">{blog.title}</h1>

          {blog.tags.length > 0 && (
            <div className="blog-post-tags" aria-label="Tags">
              {blog.tags.map((tag) => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          )}
        </header>

        <div className="prose">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSlug]}
          >
            {blog.content}
          </ReactMarkdown>
        </div>

        <footer className="blog-post-footer">
          <Link
            href={siteConfig.discussionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="blog-discuss-link"
          >
            Discuss this post on GitHub →
          </Link>
        </footer>
      </article>
    </div>
  );
}

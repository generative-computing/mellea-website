import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import { getBlog, getAllBlogSlugs } from '@/lib/blogs';
import { siteConfig } from '@/config/site';
import { formatBlogDate } from '@/lib/formatDate';
import { assetUrl } from '@/lib/assetUrl';
import PageShell from '@/components/PageShell';

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
      publishedTime: `${blog.date}T12:00:00Z`,
      authors: [blog.author],
      images: [{ url: siteConfig.ogImage }],
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

export async function generateStaticParams() {
  const slugs = getAllBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const blog = getBlog(slug);
  if (!blog) notFound();

  return (
    <PageShell>
      <article className="blog-post-page">
        <div className="blog-post-page__inner">
          <Link href="/blogs/" className="blog-section__all-posts blog-post-page__back">
            <img src={assetUrl('/assets/icon-arrow-right.svg')} alt="" width={20} height={20} />
            <span>Back to all posts</span>
          </Link>

          <div className="blog-post-page__article">
            <header className="blog-post-page__header">
              <div className="blog-post-page__meta">
                <time dateTime={blog.date}>{formatBlogDate(blog.date)}</time>
                <span aria-hidden="true">·</span>
                <span>{blog.author}</span>
              </div>
              <h1 className="blog-post-page__title">{blog.title}</h1>
              {blog.tags.length > 0 && (
                <ul className="blog-card__tags" aria-label="Tags">
                  {blog.tags.map((tag) => (
                    <li key={tag} className="blog-card__tag">{tag}</li>
                  ))}
                </ul>
              )}
            </header>

            <div className="blog-post-page__prose prose">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSlug, [rehypeHighlight, { ignoreMissing: true }]]}
                urlTransform={(url) => {
                  const safe = defaultUrlTransform(url);
                  return safe.startsWith('/') ? assetUrl(safe) : safe;
                }}
              >
                {blog.content}
              </ReactMarkdown>
            </div>

            <footer className="blog-post-page__footer">
              <Link
                href={siteConfig.discussionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="blog-section__all-posts"
              >
                <span>Discuss this post on GitHub</span>
                <img src={assetUrl('/assets/icon-arrow-up-right.svg')} alt="" width={20} height={20} />
              </Link>
            </footer>
          </div>
        </div>
      </article>
    </PageShell>
  );
}

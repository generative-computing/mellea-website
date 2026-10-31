import Link from 'next/link';
import type { BlogMeta } from '@/lib/blogs';
import { formatBlogDate } from '@/lib/formatDate';

interface BlogCardProps {
  blog: BlogMeta;
}

export default function BlogCard({ blog }: BlogCardProps) {
  return (
    <article className="blog-card">
      <Link href={`/blogs/${blog.slug}/`} className="blog-card__link">
        <h3 className="blog-card__title">{blog.title}</h3>
        <p className="blog-card__excerpt">{blog.excerpt}</p>
        <div className="blog-card__meta">
          <span className="blog-card__author">{blog.author}</span>
          <time className="blog-card__date" dateTime={blog.date}>
            {formatBlogDate(blog.date)}
          </time>
        </div>
        {blog.tags.length > 0 && (
          <ul className="blog-card__tags" aria-label="Categories">
            {blog.tags.map((tag) => (
              <li key={tag} className="blog-card__tag">{tag}</li>
            ))}
          </ul>
        )}
      </Link>
    </article>
  );
}

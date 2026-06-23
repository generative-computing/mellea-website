import Link from 'next/link';
import type { BlogMeta } from '@/lib/blogs';

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function BlogCard({ blog }: { blog: BlogMeta }) {
  return (
    <article className="blog-card">
      <Link href={`/blogs/${blog.slug}`} className="blog-card__link">
        <h3 className="blog-card__title">{blog.title}</h3>
        <p className="blog-card__excerpt">{blog.excerpt}</p>
        <p className="blog-card__meta">{formatDate(blog.date)} &middot; {blog.author}</p>
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

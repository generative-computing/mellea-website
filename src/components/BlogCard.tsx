import Link from 'next/link';
import type { BlogMeta } from '@/lib/blogs';

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function BlogCard({ blog }: { blog: BlogMeta }) {
  return (
    <Link href={`/blogs/${blog.slug}`} className="blog-card">
      <div className="blog-card-meta">
        <span>{formatDate(blog.date)}</span>
        <span className="blog-card-meta-dot" />
        <span>{blog.author}</span>
      </div>

      <h3 className="blog-card-title">{blog.title}</h3>

      <p className="blog-card-excerpt">{blog.excerpt}</p>

      {blog.tags.length > 0 && (
        <div className="blog-card-tags">
          {blog.tags.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      )}

      <span className="blog-card-arrow">→</span>
    </Link>
  );
}

import Link from 'next/link';
import type { BlogMeta } from '@/lib/blogs';
import { assetUrl } from '@/lib/assetUrl';
import BlogCard from './BlogCard';

interface BlogSectionProps {
  blogs: BlogMeta[];
  title?: string;
  showAllLink?: boolean;
}

export default function BlogSection({
  blogs,
  title = 'From the blog',
  showAllLink = true,
}: BlogSectionProps) {
  return (
    <section id="blog-section" className="blog-section" aria-labelledby="blog-heading">
      <div className="blog-section__inner">
        <header className="blog-section__header">
          <h2 id="blog-heading" className="blog-section__title">{title}</h2>
          {showAllLink && (
            <Link className="blog-section__all-posts" href="/blogs/">
              <span>All posts</span>
              <img src={assetUrl('/assets/icon-arrow-right.svg')} alt="" width={20} height={20} />
            </Link>
          )}
        </header>

        <div className="blog-section__grid">
          {blogs.map((blog) => (
            <BlogCard key={blog.slug} blog={blog} />
          ))}
        </div>
      </div>
    </section>
  );
}

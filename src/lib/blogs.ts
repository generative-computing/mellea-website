import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const BLOGS_DIR = path.join(process.cwd(), 'content/blogs');

export interface BlogMeta {
  slug: string;
  title: string;
  date: string;
  author: string;
  excerpt: string;
  tags: string[];
}

export interface Blog extends BlogMeta {
  content: string;
}

export function getAllBlogs(): BlogMeta[] {
  const files = fs.readdirSync(BLOGS_DIR).filter((f) => f.endsWith('.md'));

  const blogs = files.map((filename) => {
    const slug = filename.replace(/\.md$/, '');
    const filePath = path.join(BLOGS_DIR, filename);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(raw);

    return {
      slug,
      title: data.title ?? slug,
      date: data.date ?? '',
      author: data.author ?? 'Unknown',
      excerpt: data.excerpt ?? '',
      tags: data.tags ?? [],
    } as BlogMeta;
  });

  // Sort by date descending
  return blogs.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getBlog(slug: string): Blog | null {
  const filePath = path.join(BLOGS_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  return {
    slug,
    title: data.title ?? slug,
    date: data.date ?? '',
    author: data.author ?? 'Unknown',
    excerpt: data.excerpt ?? '',
    tags: data.tags ?? [],
    content,
  };
}

export function getAllBlogSlugs(): string[] {
  return fs
    .readdirSync(BLOGS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));
}

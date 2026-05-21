import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const NEWS_DIR = path.join(process.cwd(), 'content/news');

export interface NewsItem {
  slug: string;
  title: string;
  date: string;
  category: string;
  excerpt: string;
  url: string;
  source?: string;
}

export function getAllNews(): NewsItem[] {
  const files = fs.readdirSync(NEWS_DIR).filter((f) => f.endsWith('.md'));

  const items = files.map((filename) => {
    const slug = filename.replace(/\.md$/, '');
    const filePath = path.join(NEWS_DIR, filename);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(raw);

    return {
      slug,
      title: data.title ?? slug,
      date: data.date ?? '',
      category: data.category ?? 'News',
      excerpt: data.excerpt ?? '',
      url: data.url ?? '',
      source: data.source ?? '',
    } as NewsItem;
  });

  return items.sort((a, b) => (a.date < b.date ? 1 : -1));
}

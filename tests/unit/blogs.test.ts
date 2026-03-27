import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { describe, it, expect } from 'vitest';
import { getAllBlogs, getBlog, getAllBlogSlugs } from '@/lib/blogs';

const BLOGS_DIR = path.join(process.cwd(), 'content/blogs');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Validate raw frontmatter for every post — tests go through the source files
// directly so that fallbacks in getAllBlogs() don't mask missing required fields.
describe('blog frontmatter', () => {
  const files = fs.readdirSync(BLOGS_DIR).filter((f) => f.endsWith('.md'));

  it('at least one post exists', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const filename of files) {
    const slug = filename.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(BLOGS_DIR, filename), 'utf-8');
    const { data } = matter(raw);

    describe(slug, () => {
      it('has a non-empty title', () => {
        expect(typeof data.title).toBe('string');
        expect((data.title as string).trim().length).toBeGreaterThan(0);
      });

      it('has a date in YYYY-MM-DD format', () => {
        expect(typeof data.date).toBe('string');
        expect(DATE_RE.test(data.date as string)).toBe(true);
      });

      it('has a non-empty author', () => {
        expect(typeof data.author).toBe('string');
        expect((data.author as string).trim().length).toBeGreaterThan(0);
      });

      it('has a non-empty excerpt', () => {
        expect(typeof data.excerpt).toBe('string');
        expect((data.excerpt as string).trim().length).toBeGreaterThan(0);
      });

      it('has tags as an array if present', () => {
        if (data.tags !== undefined) {
          expect(Array.isArray(data.tags)).toBe(true);
        }
      });
    });
  }
});

describe('getAllBlogs', () => {
  it('returns a non-empty array', () => {
    const blogs = getAllBlogs();
    expect(Array.isArray(blogs)).toBe(true);
    expect(blogs.length).toBeGreaterThan(0);
  });

  it('returns blogs sorted by date descending', () => {
    const blogs = getAllBlogs();
    for (let i = 0; i < blogs.length - 1; i++) {
      expect(blogs[i].date >= blogs[i + 1].date).toBe(true);
    }
  });
});

describe('getBlog', () => {
  it('returns content for a valid slug', () => {
    const blog = getBlog('thinking-about-ai');
    expect(blog).not.toBeNull();
    expect(blog?.title).toBeTruthy();
    expect(blog?.content).toBeTruthy();
  });

  it('returns null for an unknown slug', () => {
    expect(getBlog('does-not-exist')).toBeNull();
  });
});

describe('getAllBlogSlugs', () => {
  it('matches the slugs from getAllBlogs', () => {
    const slugs = getAllBlogSlugs();
    const blogs = getAllBlogs();
    expect(slugs.length).toBe(blogs.length);
    for (const blog of blogs) {
      expect(slugs).toContain(blog.slug);
    }
  });
});

<!--
AGENTS.md — Instructions for AI coding assistants (Claude, Cursor, Copilot, etc.)
-->

# Agent Guidelines for mellea-website

This is the **Next.js website** for Mellea — the landing page and developer blog deployed at mellea.ai. For the Mellea Python library itself, see the [mellea repository](https://github.com/generative-computing/mellea).

## What are you doing?

**Adding or editing a blog post** → go to [§ Adding Blog Posts](#8-adding-blog-posts). No dev environment, no code changes needed.

**Changing the site** (UI, components, CI, dependencies) → read everything below.

---

## 1. Quick Reference

```bash
npm install
npm run dev           # http://localhost:4000
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm run test:unit     # Vitest (no browser required)
npm run test:e2e      # Playwright (auto-starts dev server)
npm run build         # Static export to ./out/
```

**Branches**: `feat/topic`, `fix/description`, `docs/topic`

## 2. Directory Structure

| Path | Contents |
| --- | --- |
| `src/app/` | Next.js App Router pages and layouts |
| `src/components/` | React components |
| `src/lib/` | Server-side utilities (blog parsing, etc.) |
| `src/config/` | Site-wide configuration (`site.ts`) |
| `content/blogs/` | Markdown blog posts with YAML frontmatter |
| `public/` | Static assets (images, CNAME) |
| `tests/unit/` | Vitest unit tests |
| `tests/e2e/` | Playwright E2E tests |
| `.github/workflows/` | CI pipeline |

## 3. Coding Standards

- TypeScript throughout — no `any` without a comment explaining why
- Server Components by default; add `'use client'` only when needed
- `src/lib/blogs.ts` uses Node.js `fs` — never import it in Client Components
- `params` in Next.js 15 page components is a `Promise` — always `await params`
- No CSS modules, no Tailwind — all styles in `src/app/globals.css`
- `src/config/site.ts` is the single source of truth for URLs and repo slug

## 4. Attribution

Do **not** add AI assistant attribution to commits, PRs, code, or documentation unless explicitly asked. No `Co-Authored-By` lines, no AI-generated footers.

## 5. Commits

Plain descriptive messages: `fix: nav link selector in E2E tests`, `feat: add tags filter to blog listing`, `docs: update CONTRIBUTING.md`.

No Angular-style mandatory types required, but keep messages short and imperative.

## 6. Self-Review (before notifying user)

1. `npm run lint` clean?
2. `npm run typecheck` clean?
3. `npm run test:unit` passes?
4. `npm run test:e2e` passes?
5. `npm run build` succeeds?
6. No new `any` types introduced without justification?
7. No hardcoded URLs that should be in `src/config/site.ts`?
8. Added or edited Markdown with external links? CI will run lychee — broken links block deploy.

## 7. Architecture

**Next.js 15 App Router, fully static** (`output: 'export'`). Nothing runs at request time — all pages are pre-rendered at build time or handled client-side.

### Key constraints

- No `next/headers`, no route handlers, no server actions
- `Image` component uses `unoptimized: true` (required for static export)
- `trailingSlash: true` is set in `next.config.mjs`
- `params` in page components is a `Promise` in Next.js 15 — always `await params`
- `src/lib/blogs.ts` uses Node.js `fs` — **Server Components only**, never import in Client Components

### Data flow

- **Build-time** (Server Components): `getAllBlogs()` → landing page + blog listing; `getAllBlogSlugs()` + `getBlog(slug)` → individual post pages
- **Client-side** (Client Components): GitHub API stats via `useGitHubStats` hook on mount; image compare slider via `react-compare-slider`

### Styling

- Single global CSS file: `src/app/globals.css`
- IBM Plex Sans + IBM Plex Mono (Google Fonts)
- Dark/light theme via CSS custom properties + `@media (prefers-color-scheme: light)`
- No CSS modules, no Tailwind

### Deployment

Pushing to `main` triggers `.github/workflows/nextjs.yml`. Pipeline: lint → (test-unit ∥ build) → test-e2e → deploy. Static artifact produced by `next build` with `output: 'export'`, deployed to GitHub Pages.

## 8. Adding Blog Posts

Drop a `.md` file in `content/blogs/`. The filename becomes the URL slug: `my-post.md` → `/blogs/my-post`.

Required frontmatter:

```md
---
title: "Your Post Title"
date: "2026-03-27"
author: "Your Name"
excerpt: "One sentence shown on the blog listing and cards."
tags: ["tag1", "tag2"]        # optional
coverImage: "/images/blog/my-post.png"  # optional, path relative to public/
---
```

| Field        | Required | Notes                           |
| ------------ | -------- | ------------------------------- |
| `title`      | Yes      | Post title                      |
| `date`       | Yes      | `YYYY-MM-DD`, used for sorting  |
| `author`     | Yes      | Display name                    |
| `excerpt`    | Yes      | Shown on cards and listing page |
| `tags`       | No       | Array of strings                |
| `coverImage` | No       | Path relative to `public/`      |

Verify with `npm run build` — no config changes or code edits needed.

## 9. Common Issues

| Problem | Fix |
| --- | --- |
| `params` type error in page component | `params` is `Promise<{slug: string}>` in Next.js 15 — use `await params` |
| E2E test strict mode violation | Scope selector (e.g. `page.getByRole('banner').getByRole('link', ...)`) |
| `fs` import error in client bundle | Move the import to a Server Component; never import `src/lib/blogs.ts` client-side |
| ESLint config error | Uses ESLint 9 flat config (`eslint.config.mjs`) — no legacy `.eslintrc` |

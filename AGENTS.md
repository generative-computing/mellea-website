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
npm run lint:md       # Markdown lint (content files)
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
| `content/blogs/` | Markdown blog posts with YAML front matter |
| `public/css/` | Global stylesheets |
| `public/js/` | Vanilla ES-module landing-page interactions |
| `public/` | Static assets (fonts, images, CNAME) |
| `tests/unit/` | Vitest unit tests |
| `tests/e2e/` | Playwright E2E tests |
| `.github/workflows/` | CI pipeline |

## 3. Coding Standards

- TypeScript throughout — no `any` without a comment explaining why
- Server Components by default; add `'use client'` only when needed
- `src/lib/blogs.ts` uses Node.js `fs` — never import it in Client Components
- `params` in page components is a `Promise` — always `await params`
- Plain CSS only — no CSS modules, no Tailwind; global styles live in `public/css/`
- `src/config/site.ts` is the single source of truth for URLs and repo slug

## 4. AI Coding Assistants

AI-assisted development is welcome. You are responsible for reviewing and understanding every change before submitting.

AI coding assistants following project guidelines add an `Assisted-by:` trailer to commit messages by default, identifying which tool was used:

```text
Assisted-by: Claude Code
Assisted-by: IBM Bob
```

Add one line per tool used, using its common name (GitHub Copilot, Cursor, etc.). Do not add `Co-Authored-By` lines for AI tools.

## 5. Commits

Follow [Angular commit format](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit), matching the [mellea repo](https://github.com/generative-computing/mellea): `<type>: <subject>`, with an optional body and footer.

**Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `ci`, `chore`, `release`.

Examples: `fix: nav link selector in E2E tests`, `feat: add tags filter to blog listing`, `docs: update CONTRIBUTING.md`.

**Sign off every commit** with `git commit -s` (DCO is enforced in CI).

## 6. Pre-commit Checklist (mandatory — do not skip)

Run the appropriate checks **before every commit**. CI will reject failures; fixing them after the fact wastes pipeline time.

### Code changes (any `.ts`, `.tsx`, `.css`, `.mjs`, or config file)

```bash
npm run lint          # must be clean
npm run typecheck     # must be clean
npm run test:unit     # must pass
npm run test:e2e      # must pass
```

If you rename or remove a CSS class, check `tests/e2e/` for selectors that reference it and update them in the same commit.

### Additional checks (code changes)

- No new `any` types without a comment explaining why
- No hardcoded URLs — use `src/config/site.ts`
- External links in Markdown? CI runs lychee — broken links block deploy

## 7. Architecture

**Next.js App Router, fully static** (`output: 'export'`). Nothing runs at request time — all pages are pre-rendered at build time or handled client-side.

### Key constraints

- No `next/headers`, no route handlers, no server actions
- `Image` component uses `unoptimized: true` (required for static export)
- `trailingSlash: true` is set in `next.config.mjs`
- `params` in page components is a `Promise` — always `await params`
- `src/lib/blogs.ts` uses Node.js `fs` — **Server Components only**, never import in Client Components

### Data flow

- **Build-time** (Server Components): `getAllBlogs()` → landing page + blog listing; `getAllBlogSlugs()` + `getBlog(slug)` → individual post pages
- **Client-side**: GitHub star count via the `GitHubStarsInit` component on mount; landing-page interactions (cursor, hero, compare slider, code panel) via vanilla ES modules in `public/js/`

### Styling

- Global stylesheets in `public/css/`: `styles.css` (site) + `code-theme.css` (syntax highlighting), linked from `layout.tsx`
- Self-hosted **Aileron** (sans) + **JetBrains Mono** via `public/assets/fonts.css`
- Light theme via CSS custom properties on `:root`
- Landing-page interactions (cursor, hero, compare slider, code panel) are vanilla ES modules in `public/js/`
- Plain CSS only — no CSS modules, no Tailwind

### Landing-page JS (`public/js/`)

These are plain browser ES modules — served statically and loaded via a `<script type="module">` tag, not bundled or transpiled. They are JavaScript, not TypeScript, and are intentionally outside `tsconfig`, so `npm run typecheck` does not cover them. The JSDoc `@param`/`@returns` annotations are for editor hints and readability only; they are **not** enforced by `tsc`, so do not assume these files are type-checked because they carry JSDoc. ESLint is the quality gate here — the flat config lints `public/js/**/*.js` with `eslint:recommended` plus `no-unused-vars`/`no-undef` and browser globals.

### Deployment

Pushing to `main` triggers `.github/workflows/nextjs.yml`. Pipeline: lint → (test-unit ∥ build) → test-e2e → deploy. Static artifact produced by `next build` with `output: 'export'`, deployed to GitHub Pages.

## 8. Adding Blog Posts

Drop a `.md` file in `content/blogs/`. The filename becomes the URL slug: `my-post.md` → `/blogs/my-post`.

**Naming rules** — the filename is a permanent public URL; once published it cannot be changed without breaking existing links (this site has no redirect support).

- Use the topic as the slug, not a description of the content type: `llm-provider-failover.md`, not `blog-llm-provider-failover.md`
- Never prefix with `blog-`, `post-`, `article-`, or similar — the `/blogs/` path already provides that context
- Append `-mellea` only if needed to disambiguate from a generic topic name

Required front matter:

```md
---
title: "Your Post Title"
date: "YYYY-MM-DD"
author: "Your Name"
excerpt: "One sentence shown on the blog listing and cards."
tags: ["tag1", "tag2", "etc"]
---
```

| Field     | Required | Notes                           |
| --------- | -------- | ------------------------------- |
| `title`   | Yes      | Post title                      |
| `date`    | Yes      | `YYYY-MM-DD`, used for sorting  |
| `author`  | Yes      | Display name                    |
| `excerpt` | Yes      | Shown on cards and listing page |
| `tags`    | No       | Array of strings                |

Set `date` to a future date matching when the post will go live, not when it was drafted — PRs typically take days to review.

Use **US spelling** throughout (`color` not `colour`, `organized` not `organised`). This applies regardless of the author's locale — consistency across posts matters more than author preference.

**Publish-date reminder** — include this line in the PR description, matching the front matter `date`:

```text
/remind 2026-05-15
```

A workflow runs daily at ~9am Eastern and posts a reminder comment on the PR once the date arrives, asking the author to enable auto-merge. The PR should be approved by then so it can be enqueued immediately.

Verify with `npm run build` — no config changes or code edits needed.

## 9. Common Issues

| Problem | Fix |
| --- | --- |
| `params` type error in page component | `params` is `Promise<{slug: string}>` — use `await params` |
| E2E test strict mode violation | Scope selector (e.g. `page.getByRole('banner').getByRole('link', ...)`) |
| `fs` import error in client bundle | Move the import to a Server Component; never import `src/lib/blogs.ts` client-side |
| ESLint config error | Uses ESLint 9 flat config (`eslint.config.mjs`) — no legacy `.eslintrc` |

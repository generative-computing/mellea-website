# Contributing

There are two distinct ways to contribute:

- **Writing a blog post** — add a Markdown file and verify it renders. [Jump to that section.](#adding-a-blog-post)
- **Changing the site** — UI, CI, or dependencies. Requires a full dev setup. [Jump to that section.](#development-setup)

---

## Adding a blog post

### Submission steps

1. Fork the repository.

2. Copy `templates/blog-post.md` to `content/blogs/your-slug.md`.
   The filename becomes the URL slug (`my-post.md` → `/blogs/my-post`), so choose a
   descriptive topic name and avoid redundant prefixes like `blog-`.

3. Fill in the YAML front matter at the top of the file:

   ```md
   ---
   title: "Your Post Title"
   date: "YYYY-MM-DD"
   author: "Your Name"
   excerpt: "One sentence shown on the blog listing and cards."
   tags: ["tag1", "tag2", "etc"]
   ---

   Your Markdown content starts here.
   ```

4. Install dependencies and verify your post locally:

   ```bash
   npm install
   npm run lint:md   # Markdown style check — must pass
   npm run dev       # preview at http://localhost:4000/blogs/your-slug
   ```

5. Open a PR against `main` on this repository. A member of the
   **mellea-maintainers** team must approve the PR before it can be merged.

6. Once merged, the CI pipeline builds and deploys the site automatically —
   your post will be live at `mellea.ai/blogs/your-slug` within a few minutes.

### Front matter fields

| Field         | Required | Description                                          |
| ------------- | -------- | ---------------------------------------------------- |
| `title`       | Yes      | Post title                                           |
| `date`        | Yes      | Publication date (`YYYY-MM-DD`), used for sort order |
| `author`      | Yes      | Author display name                                  |
| `excerpt`     | Yes      | Short summary shown on cards and the listing page    |
| `tags`        | No       | Array of tag strings                                 |

### Adding images

Place image files in `public/images/` and reference them with an absolute path from the site root:

```md
![Alt text](/images/my-image.png)
```

No config changes or code edits are needed — just the Markdown file and any images.

---

## Development setup

```bash
npm install
npm run dev       # http://localhost:4000
```

For E2E tests, install the Playwright browser once:

```bash
npx playwright install chromium
```

---

## Commands

| Command              | What it does                                          |
| -------------------- | ----------------------------------------------------- |
| `npm run dev`        | Start dev server on <http://localhost:4000>           |
| `npm run build`      | Static export to `./out/`                             |
| `npm run lint`       | ESLint (flat config, ESLint 9)                        |
| `npm run typecheck`  | TypeScript type check (`tsc --noEmit`)                |
| `npm run test:unit`  | Vitest unit tests                                     |
| `npm run test:e2e`   | Playwright E2E tests (uses dev server locally)        |

---

## Verification

Before pushing, run:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
```

The build is also a correctness check — `npm run build` must succeed with no errors.

### Link checking

External links in Markdown files are checked in CI by [lychee](https://github.com/lycheeverse/lychee) and will block deployment if broken. To run the same check locally (requires `brew install lychee`):

```bash
lychee --exclude 'localhost' --exclude '^#' content/blogs/**/*.md *.md
```

This is optional before pushing — CI will catch broken links. If you need to bypass a transient failure (e.g. a flaky external server), add `[skip link check]` to your commit message or set `SKIP_LINK_CHECK=true` in the repository variables.

### Unit tests (Vitest)

Tests live in `tests/unit/`. They run against the source directly with no browser needed.
Cover the server-side blog parsing utilities in `src/lib/blogs.ts`.

### E2E tests (Playwright)

Tests live in `tests/e2e/`. Locally, they start the dev server automatically via the `webServer` config in `playwright.config.ts` (port 4000). In CI, they run against the pre-built `./out/` served on port 3000.

If a test fails, Playwright writes a trace and HTML report to `playwright-report/`. Open it with:

```bash
npx playwright show-report
```

---

## CI pipeline

Every push and PR runs the following jobs in order:

```text
lint (ESLint + tsc)
    │
    ├── test-unit (Vitest)     ← runs in parallel with build
    │
    └── build (next build)
            │
            └── test-e2e (Playwright against ./out)
                    │
                    └── deploy (GitHub Pages, main branch only)
```

PRs must pass lint, test-unit, build, and test-e2e before merging. Deployment only happens on push to `main`.

On E2E failure, a `playwright-report` artifact is uploaded to the GitHub Actions run for inspection.

---

## Architecture

**Next.js 15 App Router, fully static** (`output: 'export'`). Nothing runs at request time — all pages are pre-rendered at build time or handled client-side.

### Key constraints

- No `next/headers`, no route handlers, no server actions
- `Image` component uses `unoptimized: true` (required for static export)
- `trailingSlash: true` is set in `next.config.mjs`
- Blog data fetching uses Node.js `fs` inside Server Components only — `src/lib/blogs.ts` is **not** safe to import in Client Components

### Site configuration

`src/config/site.ts` is the single source of truth for the GitHub repo slug, site name, and external URLs.

### Styling

Single global CSS file: `src/app/globals.css`. IBM Plex fonts via Google Fonts. Dark/light theme via CSS custom properties and `@media (prefers-color-scheme: light)`. No CSS modules, no Tailwind.

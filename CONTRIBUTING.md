# Contributing

There are three ways to contribute:

- **Writing a blog post** — add a Markdown file and verify it renders. [Jump to that section.](#adding-a-blog-post)
- **Adding a news highlight** — add a short Markdown file to surface events, releases, or features. [Jump to that section.](#adding-a-news-item)
- **Changing the site** — UI, CI, or dependencies. Requires a full dev setup. [Jump to that section.](#development-setup)

All contributions must be signed off under the [Developer Certificate of Origin](#developer-certificate-of-origin-dco) — use `git commit -s` on every commit.

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

   Include this line in the PR description to get a reminder when the post is due to publish:

   ```text
   /remind 2026-05-15
   ```

   Use the same date as the front matter `date` field. A workflow runs daily at ~9am Eastern and posts a reminder comment on the PR once the date arrives, asking you to enable auto-merge. The PR should be approved by then so it can be enqueued immediately.

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

Set `date` to a future date that reflects when the post will go live, not when it was drafted — PRs typically take days to review.

### Adding images

Place image files in `public/images/` and reference them with an absolute path from the site root:

```md
![Alt text](/images/my-image.png)
```

No config changes or code edits are needed — just the Markdown file and any images.

---

## Adding a news item

News items are short highlights that appear on the landing page to draw attention to things that matter to users — upcoming events (conferences, meetups, webinars), new releases, notable integrations or features, community milestones, or any other timely announcement. Unlike blog posts, news items link out to an external URL and do not have their own page on the site.

### Steps

1. Fork the repository.

2. Create a new file in `content/news/your-slug.md`.
   The filename is internal only (not a public URL), but keep it descriptive.

3. Fill in the YAML front matter:

   ```md
   ---
   title: "Short Headline"
   date: "YYYY-MM-DD"
   category: "Release"
   excerpt: "One sentence description shown on the card."
   url: "https://example.com/full-link"
   source: "GitHub"
   ---
   ```

   No markdown body content is needed — only the front matter is used.

4. Verify locally:

   ```bash
   npm install
   npm run build   # must succeed with no errors
   npm run dev     # check the landing page at http://localhost:4000
   ```

5. Open a PR against `main`. A member of the **mellea-maintainers** team must approve before merge.

6. Once merged, the news item will appear in the "Latest News" section on the landing page within a few minutes.

### News front matter fields

| Field      | Required | Description                                                                  |
| ---------- | -------- | ---------------------------------------------------------------------------- |
| `title`    | Yes      | Short headline for the card                                                  |
| `date`     | Yes      | Date (`YYYY-MM-DD`), used for sort order                                     |
| `category` | Yes      | One of: `Release`, `Event`, `Integration`, `Community`, `Feature`            |
| `excerpt`  | Yes      | One sentence shown on the card                                               |
| `url`      | Yes      | External link target (must be a full URL starting with `https://`)           |
| `source`   | No       | Label shown on the link (e.g. "GitHub", "PyCon"); defaults to "Read more"    |

### Categories

Each category gets a distinct accent color on the card to help users scan at a glance:

| Category      | Color  | Use for                                        |
| ------------- | ------ | ---------------------------------------------- |
| `Release`     | Blue   | New versions, changelogs                       |
| `Event`       | Green  | Conferences, meetups, webinars                 |
| `Integration` | Purple | New framework or tool integrations             |
| `Community`   | Cyan   | Community milestones, spotlights               |
| `Feature`     | Blue   | Notable new capabilities                       |

No config changes or code edits are needed — just the Markdown file.

---

## Developer Certificate of Origin (DCO)

All contributions to this repository — blog posts, news items, and code changes —
must be signed off under the [Developer Certificate of Origin](https://developercertificate.org/),
which certifies that you have the right to submit your work under the project's
license. By signing off on a commit, you are agreeing to the terms of the DCO
(full text below).

**Sign off every commit** using `-s` or `--signoff`:

```bash
git commit -s -m "your commit message"
```

This appends a `Signed-off-by` trailer using your `user.name` and `user.email` from
git config:

```text
Signed-off-by: Jane Doe <jane@example.com>
```

Use your real name and a reachable email. PRs with unsigned commits will be blocked
by the DCO check until every commit is signed off. To retroactively sign existing
commits, use `git rebase --signoff <base>` and force-push.

<details>
<summary>Developer Certificate of Origin v1.1 (full text)</summary>

```text
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

</details>

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

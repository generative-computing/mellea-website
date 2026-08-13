<!-- markdownlint-disable -->
# Redesign Branch Notes

This branch (`redesign`) on the fork `ajbozarth/mellea-website` hosts the new
site implementation that will replace the current code wholesale. It also serves
a **live preview** via GitHub Pages at:

> https://ajbozarth.github.io/mellea-website/

This doc tracks three things:

1. **Keep-list** — content/config that must survive the rewrite (do NOT delete).
2. **Revert-list** — temporary fork-preview hacks that must be undone before the
   work is merged back upstream.
3. **Access & deploy** — how teammates push here and how the preview deploys.

---

## 1. Keep-list — files the rewrite must preserve

The redesign replaces the **site code** (`src/`, build/test config tied to the
current implementation). The following is **not** site code and must remain so
the new site keeps its content, assets, and CI:

| Path | Why it must stay |
|------|------------------|
| `content/blogs/` | ⭐ The entire editorial corpus — 17 blog posts. Irreplaceable. |
| `public/images/` | Images referenced by blog markdown via `/images/...`. Losing these breaks posts. |
| `public/llms.txt` | LLM crawler manifest (SEO). |
| `public/robots.txt` | Crawler rules. |
| `public/CNAME.sav` | Stashed upstream custom domain — restore to `CNAME` before upstream merge (see revert-list). |
| `public/mellea-logo.svg` / `.png` (under `public/images/`) | Brand assets used across content. |
| `templates/blog-post.md` | Blog authoring template that `AGENTS.md` directs authors to. |
| `lychee.toml` | Link-check config consumed by CI (`nextjs.yml`). |
| `.markdownlint-cli2.jsonc` | Markdown lint config used by `npm run lint:md` in CI. |
| `.github/` (workflows, CODEOWNERS, public templates) | CI + repo governance. *(author already aware)* |
| Root `*.md` — `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `LICENSE` | Project docs/license. *(author already aware)* |

> Note: the new implementation is free to **change how `content/` is consumed**
> (loader, rendering, routing) — but the markdown and image files themselves
> must carry over intact. If image paths change, every blog's `/images/...`
> reference has to be updated in lockstep.

---

## 2. Revert-list — temporary fork-preview changes

These edits exist ONLY to serve the preview from this fork. They must be undone
before `redesign` is merged into upstream `generative-computing/mellea-website`.
Each is tagged with a `TEMP(redesign):` comment in the source.

| File | Change | Revert to |
|------|--------|-----------|
| `.github/workflows/nextjs.yml` | `push.branches` includes `"redesign"` | `["main"]` |
| `.github/workflows/nextjs.yml` | `build` step has `NEXT_PUBLIC_BASE_PATH` env block | remove the `env:` block (it is a no-op on main, but should not ship) |
| `.github/workflows/nextjs.yml` | `deploy` job `needs: [test-unit, build]` and gate `github.ref == 'refs/heads/redesign'` | restore `needs: [test-unit, test-e2e, link-check]` and the original main-gated `if` (full snippet is in the `TEMP(redesign)` comment above the job) |

> **Why deploy isn't gated on `test-e2e` / `link-check` on this branch:** the
> preview build uses `basePath=/mellea-website`, but the e2e tests serve `out/`
> at the server root and assert the *current* site's structure — so they 404 /
> fail against both the basePath and the upcoming wholesale rewrite. `link-check`
> also flags the preview URL until the first deploy publishes it. Both jobs still
> **run and report status on the PR**; they just don't block the preview. They
> return to blocking the deploy on `main` after the revert.
| `public/CNAME` → `public/CNAME.sav` | Renamed so Pages ignores it (the `mellea.ai` custom domain belongs to upstream and only works there) | `git mv public/CNAME.sav public/CNAME` before upstream merge |

Quick check before merging upstream:

```bash
grep -rn "TEMP(redesign)" .github/   # should return nothing after revert
git diff upstream/main -- .github/workflows/nextjs.yml public/CNAME
```

---

## 3. Access & deploy

### Teammate push access
Teammates are maintainers on **upstream**, which grants no access to this
personal fork. Access to this branch is granted via the **draft upstream PR**
(`ajbozarth:redesign` → `generative-computing:main`) with **"Allow edits by
maintainers"** enabled. That lets any upstream-write maintainer push directly to
`redesign` on this fork while the PR is open.

Push target for teammates:

```bash
git push https://github.com/ajbozarth/mellea-website.git HEAD:redesign
```

(Access ends when the PR is closed. Works only because the fork is owned by a
personal account.)

### Deploy
- Pushing to `redesign` runs `nextjs.yml`, which builds with
  `NEXT_PUBLIC_BASE_PATH=/mellea-website` and deploys to GitHub Pages on the fork.
- The upstream PR's own checks run lint/build/tests but do **not** deploy
  (fork PRs get a read-only token; the deploy gate also excludes PR refs).
- Preview URL: https://ajbozarth.github.io/mellea-website/

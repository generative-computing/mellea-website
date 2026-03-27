# Mellea Website

Landing page and developer blog for **[Mellea](https://github.com/generative-computing/mellea)** — a composable, multi-agent framework for building reliable AI agents at production scale.

Built with Next.js 15, statically exported, and deployed to GitHub Pages at [mellea.ai](https://mellea.ai).

---

## Pages

| Route | Description |
| --- | --- |
| `/` | Landing page — hero, feature overview, recent blog posts |
| `/blogs` | Full list of all blog posts |
| `/blogs/[slug]` | Individual blog post (rendered from Markdown) |

---

## Contributing

There are two distinct ways to contribute — pick the one that applies:

### Writing a blog post

No development environment needed. Just drop a Markdown file in `content/blogs/` and run `npm run build` to verify. See [CONTRIBUTING.md § Adding a blog post](CONTRIBUTING.md#adding-a-blog-post) for the frontmatter reference.

### Changing the site (UI, CI, dependencies)

```bash
npm install
npm run dev   # http://localhost:4000
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development guide — commands, testing, and CI pipeline.

---

## Tech Stack

- [Next.js 15](https://nextjs.org/) — App Router, static export (`output: 'export'`)
- [react-markdown](https://github.com/remarkjs/react-markdown) — Markdown rendering
- [gray-matter](https://github.com/jonschlinkert/gray-matter) — Frontmatter parsing
- IBM Plex Sans & IBM Plex Mono — typography

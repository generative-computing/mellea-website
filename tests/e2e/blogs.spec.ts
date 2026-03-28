import { test, expect } from '@playwright/test';

// ── Blog Index Page ──

test('blogs page renders heading', async ({ page }) => {
  await page.goto('/blogs/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(/Blog/);
});

test('blog index lists posts with metadata', async ({ page }) => {
  await page.goto('/blogs/');
  // Scope to main to exclude header nav; exclude the /blogs/ index link itself
  const cards = page.getByRole('main').locator('a[href^="/blogs/"]:not([href="/blogs/"])');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(2);

  // Each card should have a year (date metadata) and link to a blog post
  for (const card of await cards.all()) {
    await expect(card).toContainText(/\d{4}/);
    await expect(card).toHaveAttribute('href', /\/blogs\//);
  }
});

// ── Blog Post Navigation ──

test('clicking a post navigates to post page', async ({ page }) => {
  await page.goto('/blogs/');
  // Click the first blog card
  await page.getByRole('main').locator('a[href^="/blogs/"]:not([href="/blogs/"])').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('← Back to all posts')).toBeVisible();
});

test('back link navigates to blog index', async ({ page }) => {
  // Navigate to any post, then back
  await page.goto('/blogs/');
  await page.getByRole('main').locator('a[href^="/blogs/"]:not([href="/blogs/"])').first().click();
  await page.getByRole('link', { name: '← Back to all posts' }).click();
  // Wait for the blog index to fully render
  await expect(page.getByRole('main').locator('a[href^="/blogs/"]:not([href="/blogs/"])').first()).toBeVisible();
});

// ── Blog Post Structure ──

test('blog post has heading, metadata, and prose content', async ({ page }) => {
  // Navigate to first available post via the index
  await page.goto('/blogs/');
  const firstCard = page.getByRole('main').locator('a[href^="/blogs/"]:not([href="/blogs/"])').first();
  const href = await firstCard.getAttribute('href');
  await page.goto(href!);

  // Heading
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Metadata eyebrow (author · date) — scoped to article
  const article = page.getByRole('article');
  await expect(article).toContainText(/\d{4}/); // has a year

  // Prose body is non-empty
  await expect(article.locator('.prose')).not.toBeEmpty();
});

test('blog post has tags when present', async ({ page }) => {
  await page.goto('/blogs/');
  const firstCard = page.getByRole('main').locator('a[href^="/blogs/"]:not([href="/blogs/"])').first();
  const href = await firstCard.getAttribute('href');
  await page.goto(href!);

  // Tags section should exist (all current posts have tags)
  const tags = page.getByLabel('Tags').locator('span');
  const count = await tags.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

test('blog post has discussion link', async ({ page }) => {
  await page.goto('/blogs/');
  const firstCard = page.getByRole('main').locator('a[href^="/blogs/"]:not([href="/blogs/"])').first();
  const href = await firstCard.getAttribute('href');
  await page.goto(href!);

  const link = page.getByRole('link', { name: /Discuss this post/i });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
});

// ── Multiple Posts Render ──

test('all blog posts from index are reachable', async ({ page }) => {
  await page.goto('/blogs/');
  const cards = page.getByRole('main').locator('a[href^="/blogs/"]:not([href="/blogs/"])');
  const hrefs: string[] = [];
  for (const card of await cards.all()) {
    const href = await card.getAttribute('href');
    if (href) hrefs.push(href);
  }
  expect(hrefs.length).toBeGreaterThanOrEqual(2);

  // Each post should load and have an h1
  for (const href of hrefs) {
    await page.goto(href);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

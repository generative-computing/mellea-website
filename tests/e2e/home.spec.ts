import { test, expect } from '@playwright/test';

// ── Meta & SEO ──

test('homepage has Mellea title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Mellea/);
});

test('homepage has meta description', async ({ page }) => {
  await page.goto('/');
  const desc = page.locator('meta[name="description"]');
  await expect(desc).toHaveAttribute('content', /.{20,}/);
});

test('homepage has canonical URL', async ({ page }) => {
  await page.goto('/');
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute('href', /\/$/);
});

// ── Header / Navigation ──

test('header logo links to homepage', async ({ page }) => {
  await page.goto('/');
  const logo = page.getByRole('banner').getByRole('link', { name: /Mellea/i });
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('href', '/');
});

test('nav links are present', async ({ page }) => {
  await page.goto('/');
  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: 'Docs' })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Blog' })).toBeVisible();
  await expect(header.getByRole('link', { name: 'GitHub' })).toBeVisible();
  await expect(header.getByRole('link', { name: /Get Started/ })).toBeVisible();
});

test('external nav links open in new tab', async ({ page }) => {
  await page.goto('/');
  const header = page.getByRole('banner');
  for (const name of ['Docs', 'GitHub']) {
    const link = header.getByRole('link', { name });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  }
});

// ── Hero Section ──

test('hero heading is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Mellea/i, level: 1 })).toBeVisible();
});

test('install command is visible with copy button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('uv pip install mellea')).toBeVisible();
  await expect(page.getByLabel('Copy install command')).toBeVisible();
});

test('hero has Get Started CTA', async ({ page }) => {
  await page.goto('/');
  const hero = page.getByRole('region', { name: /Hero/i });
  await expect(hero.getByRole('link', { name: /Get Started/ })).toBeVisible();
});

test('GitHub stats section renders', async ({ page }) => {
  await page.goto('/');
  // Stats are rendered inside the hero — verify the key labels are visible
  const hero = page.getByRole('region', { name: /Hero/i });
  await expect(hero.getByText('Stars')).toBeVisible();
  await expect(hero.getByText('Forks')).toBeVisible();
});

// ── Feature Strip ──

test('feature strip shows key attributes', async ({ page }) => {
  await page.goto('/');
  const hero = page.getByRole('region', { name: /Hero/i });
  // Use text unique to the feature strip (not shared with eyebrow or body copy)
  await expect(hero.getByText('100%')).toBeVisible();
  await expect(hero.getByText(/constrained output/i)).toBeVisible();
  await expect(hero.getByText(/LLM provider/i)).toBeVisible();
});

// ── How It Works Section ──

test('how it works section renders with heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /How it works/i })).toBeVisible();
});

test('feature cards are visible with learn more links', async ({ page }) => {
  await page.goto('/');
  const cards = page.getByRole('article');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(4);

  // Each card has a heading and a learn-more link
  for (const card of await cards.all()) {
    await expect(card.getByRole('heading')).toBeVisible();
    const link = card.getByRole('link', { name: /Learn more/ });
    await expect(link).toHaveAttribute('target', '_blank');
  }
});

// ── Code Showcase ──

test('code showcase renders with tabs', async ({ page }) => {
  await page.goto('/');
  const tabs = page.locator('[role="tab"]');
  const count = await tabs.count();
  expect(count).toBeGreaterThanOrEqual(2);
});

test('code showcase tab switching changes code panel', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('[role="tabpanel"]');
  const tabs = page.locator('[role="tab"]');

  // Get initial panel text
  const firstContent = await panel.textContent();

  // Click second tab — panel content should change
  await tabs.nth(1).click();
  const secondContent = await panel.textContent();
  expect(secondContent).not.toBe(firstContent);
});

test('code showcase has copy button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Copy code')).toBeVisible();
});

test('active tab shows description and learn more link', async ({ page }) => {
  await page.goto('/');
  const activeTab = page.locator('[role="tab"][aria-selected="true"]');
  await expect(activeTab.locator('p')).toBeVisible();
  await expect(activeTab.getByRole('link', { name: /Learn more/ })).toBeVisible();
});

// ── Recent Blog Posts ──

test('recent blog posts section has heading and cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('From the blog')).toBeVisible();
  // Scope to main and exclude the /blogs/ index link to count actual post cards
  const cards = page.getByRole('main').locator('a[href^="/blogs/"]:not([href="/blogs/"])');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

// ── Vision / CTA Section ──

test('vision section has closing CTAs', async ({ page }) => {
  await page.goto('/');
  const vision = page.getByRole('region', { name: /Vision/i });
  await expect(vision).toBeVisible();
  await expect(vision.getByRole('link', { name: /Get Started/ })).toBeVisible();
  await expect(vision.getByRole('link', { name: /GitHub/ })).toBeVisible();
});

// ── Footer ──

test('footer is visible with copyright and links', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer).toBeVisible();
  await expect(footer).toContainText(/© \d{4}/);
  await expect(footer.getByRole('link', { name: 'Blog' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Docs' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'GitHub' })).toBeVisible();
});

// ── Skip Link (Accessibility) ──

test('skip-to-content link exists', async ({ page }) => {
  await page.goto('/');
  const skip = page.locator('[href="#main-content"]');
  await expect(skip).toHaveCount(1);
});

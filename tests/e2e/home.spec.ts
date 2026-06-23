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
  const logo = page.locator('.site-header').getByRole('link', { name: /Mellea home/i });
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('href', '/');
});

test('nav links are present', async ({ page }) => {
  await page.goto('/');
  const header = page.locator('.site-header');
  await expect(header.getByRole('link', { name: 'Docs' })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Blog' })).toBeVisible();
  await expect(header.getByRole('link', { name: /GitHub/i })).toBeVisible();
  await expect(header.getByRole('link', { name: /Get started/i })).toBeVisible();
});

test('external nav links open in new tab', async ({ page }) => {
  await page.goto('/');
  const header = page.locator('.site-header');
  for (const name of ['Docs', 'Community']) {
    const link = header.getByRole('link', { name });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  }
});

// ── Hero Section ──

test('hero heading is visible', async ({ page }) => {
  await page.goto('/');
  const h1 = page.locator('h1');
  await expect(h1).toBeVisible();
  await expect(h1).toHaveAttribute('aria-label', /Control LLMs/i);
});

test('install command is visible with copy button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('pip install mellea')).toBeVisible();
  await expect(page.getByLabel(/Copy pip install/i)).toBeVisible();
});

test('hero has Get Started CTA', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.hero');
  await expect(hero.getByRole('link', { name: /Get started/i })).toBeVisible();
});

// ── How Mellea Section ──

test('how mellea section renders with heading', async ({ page }) => {
  await page.goto('/');
  const heading = page.locator('#how-mellea-heading');
  await expect(heading).toBeVisible();
});

test('feature cards are visible', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('.feature-card');
  const count = await cards.count();
  expect(count).toBe(4);

  for (const card of await cards.all()) {
    await expect(card.locator('.feature-card__title')).toBeVisible();
  }
});

// ── Code Showcase ──

test('code showcase renders with tabs', async ({ page }) => {
  await page.goto('/');
  const tabs = page.locator('[role="tab"]');
  const count = await tabs.count();
  expect(count).toBe(3);
});

test('code showcase tab switching changes code panel', async ({ page }) => {
  await page.goto('/');
  const tabs = page.locator('[role="tab"]');

  // Get visible panel content (the one not hidden)
  const visiblePanel = page.locator('[role="tabpanel"]:not([hidden])');
  const firstContent = await visiblePanel.textContent();

  // Click second tab — panel content should change
  await tabs.nth(1).click();
  const secondContent = await visiblePanel.textContent();
  expect(secondContent).not.toBe(firstContent);
});

test('code showcase has copy button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Copy code to clipboard')).toBeVisible();
});

test('active tab shows description and learn more link', async ({ page }) => {
  await page.goto('/');
  const activeTab = page.locator('[role="tab"][aria-selected="true"]');
  await expect(activeTab.locator('.future-panel__tab-desc')).toBeVisible();
  await expect(activeTab.getByRole('link', { name: /Learn more/ })).toBeVisible();
});

// ── Granite Section ──

test('granite section renders', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('#granite-section');
  await expect(section).toBeVisible();
  await expect(section.locator('.granite__card-title')).toBeVisible();
});

// ── Recent Blog Posts ──

test('recent blog posts section has heading and cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('From the blog')).toBeVisible();
  const cards = page.locator('.blog-card');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

// ── Footer ──

test('footer is visible with copyright and links', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer).toBeVisible();
  await expect(footer).toContainText(/© \d{4}/);
  await expect(footer.getByRole('link', { name: /Apache 2.0/i })).toBeVisible();
  await expect(footer.getByRole('link', { name: /Contributing/i })).toBeVisible();
});

test('footer has CTA buttons', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: /Get started/i })).toBeVisible();
  await expect(footer.getByRole('link', { name: /Github/i })).toBeVisible();
});

// ── Skip Link (Accessibility) ──

test('skip-to-content link exists', async ({ page }) => {
  await page.goto('/');
  const skip = page.locator('[href="#main-content"]');
  await expect(skip).toHaveCount(1);
});

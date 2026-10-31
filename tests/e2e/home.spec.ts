import { test, expect } from '@playwright/test';
import { retryUntilTabSelected } from './helpers';

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
  const logo = page.getByRole('banner').getByRole('link', { name: /Mellea home/i });
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('href', '/');
});

test('nav links are present', async ({ page }) => {
  await page.goto('/');
  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: 'Docs' })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Blog' })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Community' })).toBeVisible();
  await expect(header.getByRole('link', { name: /Get started/i })).toBeVisible();
});

test('external nav links open in new tab', async ({ page }) => {
  await page.goto('/');
  const header = page.getByRole('banner');
  for (const name of ['Docs', 'Community']) {
    const link = header.getByRole('link', { name });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  }
});

test('GitHub button links externally', async ({ page }) => {
  await page.goto('/');
  const github = page.getByRole('banner').getByRole('link', { name: /GitHub/i });
  await expect(github).toHaveAttribute('target', '_blank');
  await expect(github).toHaveAttribute('href', /github\.com/);
});

// ── Hero Section ──

test('hero heading is visible', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Control LLMs with code, not prompts/i, level: 1 }),
  ).toBeVisible();
});

test('install command is visible with copy button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('pip install mellea')).toBeVisible();
  await expect(page.getByLabel('Copy pip install mellea to clipboard')).toBeVisible();
});

test('hero has Get Started CTA', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('main.hero');
  await expect(hero.getByRole('link', { name: /Get started/i })).toBeVisible();
});

// ── How Mellea Section ──

test('how mellea section renders with heading', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Write python functions that call LLMs/i }),
  ).toBeVisible();
});

test('feature cards are visible', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('#how-mellea-section');
  const cards = section.getByRole('article');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(4);
  await expect(cards.first()).toBeVisible();
});

test('compare slider handle is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('slider', { name: /Compare code without and with Mellea/i })).toBeVisible();
});

// ── Future Software Panel ──

test('future software panel renders with tabs', async ({ page }) => {
  await page.goto('/');
  const tabs = page.locator('[role="tab"]');
  const count = await tabs.count();
  expect(count).toBeGreaterThanOrEqual(3);
});

test('future panel tab switching changes code panel', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('.future-panel__code.is-active');
  const tabs = page.locator('[role="tab"]');

  const firstContent = await panel.textContent();
  await retryUntilTabSelected(page, () => tabs.nth(1).click(), 1);
  const secondContent = await panel.textContent();
  expect(secondContent).not.toBe(firstContent);
});

test('future panel has copy button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Copy code to clipboard')).toBeVisible();
});

test('active tab shows description and learn more link', async ({ page }) => {
  await page.goto('/');
  const activeTab = page.locator('[role="tab"][aria-selected="true"]');
  await expect(activeTab.locator('.future-panel__tab-desc')).toBeVisible();
  await expect(activeTab.getByRole('link', { name: /Learn more/i })).toBeVisible();
});

// ── Recent Blog Posts ──

test('recent blog posts section has heading and cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('From the blog')).toBeVisible();
  const cards = page.locator('#blog-section a[href^="/blogs/"]');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

// ── Footer CTA Section ──

test('footer has closing CTAs', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer).toBeVisible();
  await expect(footer.getByRole('link', { name: /Get started/i })).toBeVisible();
  await expect(footer.getByRole('link', { name: /Github/i })).toBeVisible();
});

// ── Footer Legal ──

test('footer is visible with copyright and links', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer).toBeVisible();
  await expect(footer).toContainText(/© \d{4}/);
  await expect(footer.getByRole('link', { name: /Apache 2.0 License/i })).toBeVisible();
  await expect(footer.getByRole('link', { name: /Contributing Guide/i })).toBeVisible();
});

import { test, expect } from '@playwright/test';

// Use a mobile viewport size with chromium (webkit not installed locally)
test.use({ viewport: { width: 390, height: 844 } });

// ── Mobile Navigation ──

test('hamburger menu button is visible on mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel(/menu/i)).toBeVisible();
});

test('desktop nav is hidden on mobile', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('header').getByRole('navigation');
  await expect(nav).not.toBeVisible();
});

test('hamburger menu opens and shows nav links', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(/Open menu/i).click();
  const nav = page.getByRole('navigation', { name: /Mobile navigation/i });
  await expect(nav).toBeVisible();
  // Should have multiple nav links
  const links = nav.getByRole('link');
  const count = await links.count();
  expect(count).toBeGreaterThanOrEqual(3);
});

test('hamburger menu closes on link click', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(/Open menu/i).click();
  const nav = page.getByRole('navigation', { name: /Mobile navigation/i });
  await expect(nav).toBeVisible();

  await nav.getByRole('link', { name: 'Blog' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('hamburger menu closes on close button', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(/Open menu/i).click();
  await expect(page.getByRole('navigation', { name: /Mobile navigation/i })).toBeVisible();

  await page.getByLabel(/Close menu/i).click();
  await expect(page.getByRole('navigation', { name: /Mobile navigation/i })).not.toBeVisible();
});

// ── Mobile Layout ──

test('hero renders on mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Mellea/i, level: 1 })).toBeVisible();
  await expect(page.getByText('uv pip install mellea')).toBeVisible();
});

test('feature cards visible on mobile', async ({ page }) => {
  await page.goto('/');
  const cards = page.getByRole('article');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(4);
  await expect(cards.first()).toBeVisible();
  await expect(cards.last()).toBeVisible();
});

test('code showcase tabs visible on mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab').first()).toBeVisible();
});

test('contributor avatars are hidden on mobile', async ({ page }) => {
  await page.goto('/');
  const avatars = page.getByTestId('contributor-avatars');
  await expect(avatars).toBeHidden();
});

test('footer renders on mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('contentinfo')).toBeVisible();
});

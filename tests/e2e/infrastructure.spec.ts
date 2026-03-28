import { test, expect } from '@playwright/test';

// ── 404 Page ──

test('404 page renders for unknown routes', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist/');
  // Static export serves 404.html but HTTP status depends on server config
  // Just verify the 404 content renders
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  await expect(page.getByText(/doesn.t exist/i)).toBeVisible();
});

test('404 page has link back to home', async ({ page }) => {
  await page.goto('/this-page-does-not-exist/');
  const homeLink = page.getByRole('link', { name: /Back to home/i });
  await expect(homeLink).toBeVisible();
  await expect(homeLink).toHaveAttribute('href', '/');
});

test('404 back-to-home link navigates correctly', async ({ page }) => {
  await page.goto('/this-page-does-not-exist/');
  await page.getByRole('link', { name: /Back to home/i }).click();
  await expect(page.getByRole('heading', { name: /Mellea/i, level: 1 })).toBeVisible();
});

// ── Sitemap ──

test('sitemap.xml is accessible and contains expected URLs', async ({ page }) => {
  const response = await page.goto('/sitemap.xml');
  expect(response?.status()).toBe(200);
  const content = await page.content();
  expect(content).toContain('mellea.ai');
  expect(content).toContain('/blogs/');
});

// ── robots.txt ──

test('robots.txt is accessible', async ({ page }) => {
  const response = await page.goto('/robots.txt');
  expect(response?.status()).toBe(200);
});

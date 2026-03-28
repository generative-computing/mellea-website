import { test, expect } from '@playwright/test';

// ── Landmark Roles ──

test('page has banner, main, and contentinfo landmarks', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
});

// ── Heading Hierarchy ──

test('homepage has exactly one h1', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
});

test('blog index has exactly one h1', async ({ page }) => {
  await page.goto('/blogs/');
  await expect(page.locator('h1')).toHaveCount(1);
});

test('blog post has exactly one h1', async ({ page }) => {
  // Navigate to first available post
  await page.goto('/blogs/');
  const href = await page.getByRole('main').locator('a[href^="/blogs/"]:not([href="/blogs/"])').first().getAttribute('href');
  await page.goto(href!);
  await expect(page.locator('h1')).toHaveCount(1);
});

// ── Images ──

test('all images have alt text', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('img:not([alt])')).toHaveCount(0);
});

// ── Keyboard Navigation ──

test('code showcase tabs are keyboard navigable', async ({ page }) => {
  await page.goto('/');
  const firstTab = page.getByRole('tab').first();
  await firstTab.click();
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');

  // ArrowDown moves to next tab
  await firstTab.press('ArrowDown');
  const secondTab = page.getByRole('tab').nth(1);
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');
});

// ── External Links ──

test('external links in header/footer have rel="noopener"', async ({ page }) => {
  await page.goto('/');
  for (const region of ['header', 'footer']) {
    const links = page.locator(`${region} a[target="_blank"]`);
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (const link of await links.all()) {
      const rel = await link.getAttribute('rel');
      expect(rel).toContain('noopener');
    }
  }
});

// ── ARIA Attributes ──

test('code showcase uses proper ARIA roles', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[role="tablist"]')).toHaveCount(1);
  await expect(page.locator('[role="tabpanel"]')).toHaveCount(1);
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
});


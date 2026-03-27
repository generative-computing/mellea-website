import { test, expect } from '@playwright/test';

test('blogs page renders post listing', async ({ page }) => {
  await page.goto('/blogs/');
  await expect(page.getByRole('heading', { name: 'Blog', level: 1 })).toBeVisible();
});

test('both existing posts are listed', async ({ page }) => {
  await page.goto('/blogs/');
  await expect(page.getByText(/thinking about AI all wrong/i)).toBeVisible();
  await expect(page.getByText(/Outside-In and Inside-Out/i)).toBeVisible();
});

test('clicking a post navigates to post page', async ({ page }) => {
  await page.goto('/blogs/');
  await page.getByText(/thinking about AI all wrong/i).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('← Back to all posts')).toBeVisible();
});

test('blog post page renders content', async ({ page }) => {
  await page.goto('/blogs/thinking-about-ai/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // post body should have some prose content
  await expect(page.locator('.prose')).not.toBeEmpty();
});

import { test, expect } from '@playwright/test';

test('homepage has Mellea title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Mellea/);
});

test('hero heading is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Mellea/i, level: 1 })).toBeVisible();
});

test('install command is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('uv pip install mellea')).toBeVisible();
});

test('nav links are present', async ({ page }) => {
  await page.goto('/');
  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: 'Blogs' })).toBeVisible();
  await expect(header.getByRole('link', { name: 'GitHub' })).toBeVisible();
});

test('recent blog posts section is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('From the blog')).toBeVisible();
});

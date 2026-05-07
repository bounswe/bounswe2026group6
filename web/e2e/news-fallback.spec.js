const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('./helpers/db');

test.beforeEach(async () => {
  await resetDatabase();
});

test('shows demo announcements with retry context when news API is unavailable', async ({ page }) => {
  await page.route('**/api/announcements**', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'ANNOUNCEMENTS_UNAVAILABLE',
        message: 'Announcements service is unavailable',
      }),
    });
  });

  await page.goto('/news');

  await expect(page.getByText('Using fallback news')).toBeVisible();
  await expect(page.getByText(/Announcements could not be refreshed/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry news' })).toBeVisible();
  await expect(page.getByText('Last updated:')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Know your nearest gathering area' })).toBeVisible();
});

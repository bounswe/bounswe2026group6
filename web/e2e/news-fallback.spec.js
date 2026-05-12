const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('./helpers/db');

const CACHED_ANNOUNCEMENTS_KEY = 'neph.publicAnnouncements.cache.v1';

test.beforeEach(async () => {
  await resetDatabase();
});

test('shows explicit error state when news API is unavailable and no cache exists', async ({ page }) => {
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

  await expect(page.getByText("Couldn't load announcements")).toBeVisible();
  await expect(page.getByText(/Could not load announcements/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry news' })).toBeVisible();
  await expect(page.getByText('No announcements could be loaded right now.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Know your nearest gathering area' })).toHaveCount(0);
});

test('shows cached announcements with warning when news API is unavailable', async ({ page }) => {
  await page.addInitScript((cacheKey) => {
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify({
        announcements: [
          {
            id: 'cached_announcement_1',
            adminId: 'admin-cache',
            title: 'Cached Announcement Title',
            content:
              'Cached announcement body content to verify warning-mode rendering when API is unavailable.',
            createdAt: '2026-05-10T09:00:00.000Z',
          },
        ],
        savedAt: '2026-05-10T09:05:00.000Z',
      })
    );
  }, CACHED_ANNOUNCEMENTS_KEY);

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

  await expect(page.getByText('Using cached announcements')).toBeVisible();
  await expect(page.getByText(/Showing cached announcements instead/)).toBeVisible();
  await expect(page.getByText('Last updated:')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cached Announcement Title' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry news' })).toBeVisible();
});

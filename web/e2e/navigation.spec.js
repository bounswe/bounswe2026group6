const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('./helpers/db');

test.beforeEach(async () => {
  await resetDatabase();
});

test('guest can browse public pages and is redirected away from protected pages', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue as Guest' }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(
    page.getByRole('heading', {
      name: 'We care for you and every community around you',
    })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Profile' })).toHaveCount(0);

  await page.getByRole('link', { name: 'News' }).click();
  await expect(page).toHaveURL(/\/news$/);
  await expect(page.getByRole('heading', { name: 'News', exact: true }).first()).toBeVisible();

  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fprofile$/);
  await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();
});

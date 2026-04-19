const { test, expect } = require('@playwright/test');
const { createCompletedUser, fetchMyProfile } = require('./helpers/api');
const { resetDatabase } = require('./helpers/db');
const { getStoredAccessToken, loginThroughUi } = require('./helpers/ui');

test.beforeEach(async () => {
  await resetDatabase();
});

test('verified user can log in through a protected redirect, update privacy settings, and save profile edits', async ({ page }) => {
  const email = `profile-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });

  await page.goto('/privacy-security');
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fprivacy-security$/);

  await loginThroughUi(page, { email, password });

  await expect(page).toHaveURL(/\/privacy-security$/);
  await expect(page.getByRole('heading', { name: 'Privacy & Security' })).toBeVisible();

  const locationToggle = page.getByRole('button', { name: 'Share Current Location' });
  await expect(locationToggle).toHaveAttribute('aria-pressed', 'false');

  await locationToggle.click();
  await page.getByRole('button', { name: 'Save Privacy Settings' }).click();

  await expect(page.getByText('Privacy settings updated successfully.')).toBeVisible();
  await expect(locationToggle).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('link', { name: 'Profile' }).click();
  await expect(page).toHaveURL(/\/profile$/);

  await page.locator('#height').fill('180');
  await page.locator('#extraAddress').fill('Updated Address 42');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.getByText('Profile updated successfully.')).toBeVisible();

  const accessToken = await getStoredAccessToken(page);
  const profile = await fetchMyProfile(accessToken);

  expect(profile.physicalInfo.height).toBe(180);
  expect(profile.locationProfile.address).toContain('Updated Address 42');
  expect(profile.privacySettings.locationSharingEnabled).toBe(true);

  await page.getByRole('button', { name: 'Open user menu' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();
});

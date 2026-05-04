const { test, expect } = require('@playwright/test');
const { createCompletedUser, signupUser } = require('./helpers/api');
const {
  promoteUserToAdmin,
  resetDatabase,
  waitForUserByEmail,
} = require('./helpers/db');
const { getStoredAccessToken, loginThroughUi } = require('./helpers/ui');

async function openUsersTab(page) {
  await expect(page).toHaveURL(/\/admin(\?|$)/, { timeout: 20_000 });
  if (/\/login(\?|$)/.test(page.url())) {
    throw new Error(`Admin page redirected to login unexpectedly. URL: ${page.url()}`);
  }
  if (/\/home(\?|$)/.test(page.url())) {
    throw new Error(`Admin page redirected to home unexpectedly. URL: ${page.url()}`);
  }

  await expect(
    page.getByRole('tablist', { name: 'Admin dashboard sections' }),
  ).toBeVisible({ timeout: 20_000 });

  const usersTab = page.getByRole('tab', { name: 'Users' });
  await expect(usersTab).toBeVisible({ timeout: 20_000 });
  await usersTab.click();
}

test.beforeEach(async () => {
  await resetDatabase();
});

test('non-admin user does not see Users tab and is redirected from /admin', async ({ page }) => {
  const email = `users-non-admin-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });

  await page.goto('/login?returnTo=%2Fadmin');
  await loginThroughUi(page, { email, password });

  await expect(page).toHaveURL(/\/home$/);

  // Admin dashboard tablist should never render for non-admin users.
  await expect(
    page.getByRole('tablist', { name: 'Admin dashboard sections' }),
  ).toHaveCount(0);
});

test('admin can open Users tab and see registered users with required columns', async ({ page }) => {
  const adminEmail = `users-admin-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email: adminEmail, password });
  const adminDbUser = await waitForUserByEmail(adminEmail);
  await promoteUserToAdmin({ userId: adminDbUser.user_id });

  // Another completed user — should appear in the listing with their first/last name.
  const otherEmail = `users-other-${Date.now()}@example.com`;
  await createCompletedUser({ email: otherEmail, password });
  await waitForUserByEmail(otherEmail);

  // A signed-up but unverified user — should appear with isEmailVerified=false.
  const unverifiedEmail = `users-unverified-${Date.now()}@example.com`;
  await signupUser({ email: unverifiedEmail, password });
  await waitForUserByEmail(unverifiedEmail);

  await page.goto('/login');
  await loginThroughUi(page, { email: adminEmail, password });
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible({ timeout: 20_000 });

  await page.goto('/admin');
  await openUsersTab(page);

  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

  // Table headers expected from the issue (Acceptance Criteria).
  await expect(page.getByRole('columnheader', { name: 'Username' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'User ID' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Email', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Email Verified' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Banned' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Ban Reason' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Created At' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();

  // Both seeded emails are visible in the table.
  await expect(page.getByRole('cell', { name: adminEmail })).toBeVisible();
  await expect(page.getByRole('cell', { name: otherEmail })).toBeVisible();
  await expect(page.getByRole('cell', { name: unverifiedEmail })).toBeVisible();

  // Username column shows firstName + lastName from the completed profile.
  // createCompletedUser sets firstName: "Existing", lastName: "User".
  const usernameCells = await page.getByRole('cell', { name: 'Existing User' }).count();
  expect(usernameCells).toBeGreaterThanOrEqual(2);

  // Verified vs unverified badges appear for the right rows.
  const otherRow = page.getByRole('row', { name: new RegExp(otherEmail) });
  await expect(otherRow.getByText('Verified', { exact: true })).toBeVisible();

  const unverifiedRow = page.getByRole('row', { name: new RegExp(unverifiedEmail) });
  await expect(unverifiedRow.getByText('Unverified', { exact: true })).toBeVisible();

  // Admin accounts are intentionally not bannable from the table.
  const adminRow = page.getByRole('row', { name: new RegExp(adminEmail) });
  await expect(adminRow.getByRole('button', { name: 'Ban' })).toHaveCount(0);
});

test('admin can filter users by email and verification status', async ({ page }) => {
  const adminEmail = `users-filter-admin-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email: adminEmail, password });
  const adminDbUser = await waitForUserByEmail(adminEmail);
  await promoteUserToAdmin({ userId: adminDbUser.user_id });

  const verifiedEmail = `users-filter-verified-${Date.now()}@example.com`;
  await createCompletedUser({ email: verifiedEmail, password });
  await waitForUserByEmail(verifiedEmail);

  const unverifiedEmail = `users-filter-unverified-${Date.now()}@example.com`;
  await signupUser({ email: unverifiedEmail, password });
  await waitForUserByEmail(unverifiedEmail);

  await page.goto('/login');
  await loginThroughUi(page, { email: adminEmail, password });
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible({ timeout: 20_000 });

  await page.goto('/admin');
  await openUsersTab(page);

  await expect(page.getByRole('cell', { name: unverifiedEmail })).toBeVisible();

  // Filter to verified-only — unverified user should disappear.
  await page.getByLabel('Email verification').selectOption('VERIFIED');
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect(page.getByRole('cell', { name: unverifiedEmail })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: verifiedEmail })).toBeVisible();

  // Search by email — only the matching row remains visible in the table.
  await page.getByLabel('Email contains').fill(verifiedEmail);
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect(page.getByRole('cell', { name: verifiedEmail })).toBeVisible();
  await expect(page.getByRole('cell', { name: adminEmail })).toHaveCount(0);

  // Clear filters restores admin email row.
  await page.getByRole('button', { name: 'Clear Filters' }).click();
  await expect(page.getByRole('cell', { name: adminEmail })).toBeVisible();
});

test('admin can ban and unban user, and user access is restored after unban', async ({ page }) => {
  const adminEmail = `users-moderation-admin-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email: adminEmail, password });
  const adminDbUser = await waitForUserByEmail(adminEmail);
  await promoteUserToAdmin({ userId: adminDbUser.user_id });

  const targetEmail = `users-moderation-target-${Date.now()}@example.com`;
  await createCompletedUser({ email: targetEmail, password });
  await waitForUserByEmail(targetEmail);

  await page.goto('/login');
  await loginThroughUi(page, { email: adminEmail, password });
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible({ timeout: 20_000 });
  await page.goto('/admin');
  await openUsersTab(page);

  const targetRow = page.getByRole('row', { name: new RegExp(targetEmail) });
  await expect(targetRow).toBeVisible();
  await targetRow.getByRole('button', { name: 'Ban' }).click();

  await expect(page.getByRole('dialog', { name: `Confirm ban for ${targetEmail}` })).toBeVisible();
  await page.locator('#ban-reason').fill('Repeated abusive behavior');
  await page.getByRole('button', { name: 'Confirm Ban' }).click();

  await expect(page.getByText(`User ${targetEmail} was banned successfully.`)).toBeVisible();
  await expect(targetRow.getByText('Banned', { exact: true })).toBeVisible();
  await expect(targetRow.getByText('Repeated abusive behavior')).toBeVisible();

  await page.evaluate(() => {
    window.localStorage.removeItem('neph_access_token');
    window.sessionStorage.removeItem('neph_access_token');
  });

  await page.goto('/login');
  await loginThroughUi(page, { email: targetEmail, password });
  await expect(page.getByText(/banned/i)).toBeVisible();
  await expect.poll(async () => getStoredAccessToken(page)).toBeNull();

  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fprofile$/);

  await page.goto('/login');
  await loginThroughUi(page, { email: adminEmail, password });
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible({ timeout: 20_000 });
  await page.goto('/admin');
  await openUsersTab(page);

  await targetRow.getByRole('button', { name: 'Unban' }).click();
  await expect(page.getByText(`User ${targetEmail} was unbanned successfully.`)).toBeVisible();
  await expect(targetRow.getByText('Active', { exact: true })).toBeVisible();

  await page.evaluate(() => {
    window.localStorage.removeItem('neph_access_token');
    window.sessionStorage.removeItem('neph_access_token');
  });

  await page.goto('/login');
  await loginThroughUi(page, { email: targetEmail, password });
  await expect(page).toHaveURL(/\/home$/);
});

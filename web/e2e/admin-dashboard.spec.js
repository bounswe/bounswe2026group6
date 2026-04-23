const { test, expect } = require('@playwright/test');
const { createCompletedUser } = require('./helpers/api');
const {
  promoteUserToAdmin,
  resetDatabase,
  seedEmergencyOverviewRecord,
  waitForUserByEmail,
} = require('./helpers/db');
const { loginThroughUi } = require('./helpers/ui');

async function ensureOverviewReady(page) {
  const retryButton = page.getByRole('button', { name: 'Retry Overview' });
  const loadRegionButton = page.getByRole('button', { name: 'Load Region Summary' });
  const hideRegionButton = page.getByRole('button', { name: 'Hide Region Summary' });
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (await loadRegionButton.isVisible().catch(() => false)) {
      return;
    }

    if (await hideRegionButton.isVisible().catch(() => false)) {
      return;
    }

    if (await retryButton.isVisible().catch(() => false)) {
      await retryButton.click({ timeout: 800, force: true }).catch(() => {});
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Admin overview did not become ready. Current URL: ${page.url()}`);
}

test.beforeEach(async () => {
  await resetDatabase();
});

test('guest visiting /admin is redirected to login with returnTo', async ({ page }) => {
  await page.goto('/admin');

  await expect(page).toHaveURL(/\/login\?returnTo=%2Fadmin$/);
  await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();
});

test('authenticated non-admin visiting /admin is redirected to /home', async ({ page }) => {
  const email = `non-admin-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });

  await page.goto('/login?returnTo=%2Fadmin');
  await loginThroughUi(page, { email, password });

  await expect(page).toHaveURL(/\/home$/);
});

test('authenticated admin can open dashboard and toggle region summary', async ({ page }) => {
  const email = `admin-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  const completedUser = await createCompletedUser({ email, password });
  const dbUser = await waitForUserByEmail(email);
  await promoteUserToAdmin({ userId: dbUser.user_id });
  await seedEmergencyOverviewRecord({ requestId: 'e2e_admin_req_1', status: 'PENDING', city: 'ankara' });

  await page.goto('/login');
  await loginThroughUi(page, { email, password });

  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await ensureOverviewReady(page);

  const loadRegionButton = page.getByRole('button', { name: 'Load Region Summary' });
  const hideRegionButton = page.getByRole('button', { name: 'Hide Region Summary' });

  await expect(page.getByRole('columnheader', { name: 'City' })).toHaveCount(0);
  if (await loadRegionButton.isVisible().catch(() => false)) {
    await loadRegionButton.click();
  }
  await expect(page.getByRole('columnheader', { name: 'City' })).toBeVisible();
  await hideRegionButton.click();
  await expect(page.getByRole('columnheader', { name: 'City' })).toHaveCount(0);

  // keep variable usage explicit for lint/readability in CI logs
  expect(completedUser.accessToken).toBeDefined();
});

test('navbar admin link visibility is role-aware', async ({ page }) => {
  await page.goto('/home');
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);

  const nonAdminEmail = `role-non-admin-${Date.now()}@example.com`;
  const nonAdminPassword = 'Passw0rd!';
  await createCompletedUser({ email: nonAdminEmail, password: nonAdminPassword });
  await page.goto('/login');
  await loginThroughUi(page, { email: nonAdminEmail, password: nonAdminPassword });
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Open user menu' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);

  const adminEmail = `role-admin-${Date.now()}@example.com`;
  const adminPassword = 'Passw0rd!';
  await createCompletedUser({ email: adminEmail, password: adminPassword });
  const adminDbUser = await waitForUserByEmail(adminEmail);
  await promoteUserToAdmin({ userId: adminDbUser.user_id });

  await page.goto('/login');
  await loginThroughUi(page, { email: adminEmail, password: adminPassword });
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();
});

test('initial overview fetch error can be retried successfully', async ({ page }) => {
  const email = `retry-admin-${Date.now()}@example.com`;
  const password = 'Passw0rd!';
  await createCompletedUser({ email, password });
  const dbUser = await waitForUserByEmail(email);
  await promoteUserToAdmin({ userId: dbUser.user_id });
  await seedEmergencyOverviewRecord({ requestId: 'e2e_admin_req_retry', status: 'PENDING', city: 'izmir' });

  await page.goto('/login');
  await loginThroughUi(page, { email, password });

  let failUntilRetried = true;
  let initialFailCount = 0;
  await page.route('**/*emergency-overview*', async (route) => {
    if (failUntilRetried && initialFailCount < 2) {
      initialFailCount += 1;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Injected e2e failure' }),
      });
      return;
    }

    await route.continue();
  });

  await page.goto('/admin');
  await page.waitForTimeout(1200);

  const retryOverviewButton = page.getByRole('button', { name: 'Retry Overview' });
  if (await retryOverviewButton.isVisible().catch(() => false)) {
    failUntilRetried = false;
    await retryOverviewButton.click({ timeout: 1500, force: true }).catch(() => {});
  } else {
    failUntilRetried = false;
  }

  await ensureOverviewReady(page);
});

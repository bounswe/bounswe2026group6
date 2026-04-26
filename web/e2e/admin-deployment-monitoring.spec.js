const { test, expect } = require('@playwright/test');
const { createCompletedUser } = require('./helpers/api');
const {
  promoteUserToAdmin,
  resetDatabase,
  seedEmergencyOverviewRecord,
  waitForUserByEmail,
} = require('./helpers/db');
const { loginThroughUi } = require('./helpers/ui');

async function openMonitoringTab(page) {
  await expect(page).toHaveURL(/\/admin(\?|$)/, { timeout: 20_000 });

  if (/\/login(\?|$)/.test(page.url())) {
    throw new Error(`Admin page redirected to login unexpectedly. URL: ${page.url()}`);
  }
  if (/\/home(\?|$)/.test(page.url())) {
    throw new Error(`Admin page redirected to home unexpectedly. URL: ${page.url()}`);
  }

  await expect(page.getByRole('tablist', { name: 'Admin dashboard sections' })).toBeVisible({
    timeout: 20_000,
  });

  const monitoringTab = page.getByRole('tab', { name: 'Deployment Monitoring' });
  await expect(monitoringTab).toBeVisible({ timeout: 20_000 });
  await monitoringTab.click();
}

async function ensureMonitoringReady(page) {
  const retryButton = page.getByRole('button', { name: 'Retry Monitoring' });
  const errorSubtitle = page.getByText('Could not load deployment monitoring data.', {
    exact: false,
  });
  const controlsHeading = page.getByRole('heading', {
    name: /Monitoring Controls/i,
  });

  const deadline = Date.now() + 45_000;
  let lastClickAt = 0;

  while (Date.now() < deadline) {
    if (/\/login(\?|$)/.test(page.url())) {
      throw new Error(`Monitoring redirected to login. URL: ${page.url()}`);
    }
    if (/\/home(\?|$)/.test(page.url())) {
      throw new Error(`Monitoring redirected to home. URL: ${page.url()}`);
    }

    if (await controlsHeading.isVisible().catch(() => false)) {
      return;
    }

    const inErrorState = await errorSubtitle.isVisible().catch(() => false);
    if (inErrorState && Date.now() - lastClickAt > 2_000) {
      if (await retryButton.isVisible().catch(() => false)) {
        lastClickAt = Date.now();
        await retryButton.click({ timeout: 1500, force: true }).catch(() => {});
      }
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Monitoring tab did not become ready. URL: ${page.url()}`);
}

test.beforeEach(async () => {
  await resetDatabase();
});

test('admin can open Deployment Monitoring tab and see signal sections', async ({ page }) => {
  const email = `admin-monitoring-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });
  const dbUser = await waitForUserByEmail(email);
  await promoteUserToAdmin({ userId: dbUser.user_id });

  // Old pending in istanbul/first_aid — unassigned + long-waiting + duplicate.
  await seedEmergencyOverviewRecord({
    requestId: 'e2e_dm_old_istanbul',
    status: 'PENDING',
    city: 'istanbul',
    needType: 'first_aid',
    createdAtHoursAgo: 8,
  });
  // Recent pending in istanbul/first_aid — unassigned + duplicate (shared phone).
  await seedEmergencyOverviewRecord({
    requestId: 'e2e_dm_dupe_istanbul',
    status: 'PENDING',
    city: 'istanbul',
    needType: 'first_aid',
    createdAtHoursAgo: 2,
  });
  // Old pending in ankara/water — unassigned + long-waiting.
  await seedEmergencyOverviewRecord({
    requestId: 'e2e_dm_old_ankara',
    status: 'PENDING',
    city: 'ankara',
    needType: 'water',
    createdAtHoursAgo: 8,
  });

  await page.goto('/login');
  await loginThroughUi(page, { email, password });
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible({ timeout: 20_000 });

  await page.goto('/admin');
  await openMonitoringTab(page);

  await ensureMonitoringReady(page);

  await expect(
    page.getByRole('heading', { name: /Signal Summary/i })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Unassigned Emergencies/i })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Long-waiting Emergencies/i })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Conflicting \/ Duplicate Reports/i })
  ).toBeVisible();

  // Seeded request IDs should be visible somewhere in the tables.
  await expect(page.getByText('e2e_dm_old_istanbul', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('e2e_dm_old_ankara', { exact: false }).first()).toBeVisible();
});

test('admin sees retry state on monitoring failure and recovers', async ({ page }) => {
  const email = `admin-monitoring-fail-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });
  const dbUser = await waitForUserByEmail(email);
  await promoteUserToAdmin({ userId: dbUser.user_id });

  await seedEmergencyOverviewRecord({
    requestId: 'e2e_dm_retry_seed',
    status: 'PENDING',
    city: 'istanbul',
    needType: 'first_aid',
    createdAtHoursAgo: 8,
  });

  let failNext = true;
  await page.route('**/api/admin/deployment-monitoring**', async (route) => {
    if (failNext) {
      failNext = false;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'boom' }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/login');
  await loginThroughUi(page, { email, password });
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible({ timeout: 20_000 });

  await page.goto('/admin');
  await openMonitoringTab(page);

  await ensureMonitoringReady(page);

  await expect(
    page.getByRole('heading', { name: /Monitoring Controls/i })
  ).toBeVisible({ timeout: 20_000 });
});

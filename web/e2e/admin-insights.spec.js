const { test, expect } = require('@playwright/test');
const { createCompletedUser } = require('./helpers/api');
const {
  promoteUserToAdmin,
  resetDatabase,
  seedEmergencyOverviewRecord,
  waitForUserByEmail,
} = require('./helpers/db');
const { loginThroughUi } = require('./helpers/ui');

async function openInsightsTab(page) {
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

  const insightsTab = page.getByRole('tab', { name: 'Emergency Insights' });
  await expect(insightsTab).toBeVisible({ timeout: 20_000 });
  await insightsTab.click();
}

async function ensureInsightsReady(page) {
  const retryButton = page.getByRole('button', { name: 'Retry Analytics' });
  const errorSubtitle = page.getByText('Could not load analytics data.', {
    exact: false,
  });
  const periodHeading = page.getByRole('heading', {
    name: /Period Comparison/i,
  });

  const deadline = Date.now() + 45_000;
  let lastClickAt = 0;

  while (Date.now() < deadline) {
    if (/\/login(\?|$)/.test(page.url())) {
      throw new Error(`Insights redirected to login. URL: ${page.url()}`);
    }
    if (/\/home(\?|$)/.test(page.url())) {
      throw new Error(`Insights redirected to home. URL: ${page.url()}`);
    }

    if (await periodHeading.isVisible().catch(() => false)) {
      return;
    }

    // Only click retry once the error state is actually rendered, to avoid
    // clicking the in-flight loading-state button (no-op while a request is
    // already pending). Throttle subsequent clicks.
    const inErrorState = await errorSubtitle.isVisible().catch(() => false);
    if (inErrorState && Date.now() - lastClickAt > 2_000) {
      if (await retryButton.isVisible().catch(() => false)) {
        lastClickAt = Date.now();
        await retryButton.click({ timeout: 1500, force: true }).catch(() => {});
      }
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Insights tab did not become ready. URL: ${page.url()}`);
}

test.beforeEach(async () => {
  await resetDatabase();
});

test('admin can open Emergency Insights tab and see analytics sections', async ({ page }) => {
  const email = `admin-insights-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });
  const dbUser = await waitForUserByEmail(email);
  await promoteUserToAdmin({ userId: dbUser.user_id });

  await seedEmergencyOverviewRecord({
    requestId: 'e2e_insights_pending',
    status: 'PENDING',
    city: 'ankara',
    needType: 'first_aid',
    createdAtHoursAgo: 2,
  });
  await seedEmergencyOverviewRecord({
    requestId: 'e2e_insights_resolved',
    status: 'RESOLVED',
    city: 'istanbul',
    needType: 'water',
    createdAtHoursAgo: 24,
  });
  await seedEmergencyOverviewRecord({
    requestId: 'e2e_insights_cancelled',
    status: 'CANCELLED',
    city: 'istanbul',
    needType: 'shelter',
    createdAtHoursAgo: 36,
  });

  await page.goto('/login');
  await loginThroughUi(page, { email, password });
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible({ timeout: 20_000 });

  await page.goto('/admin');
  await openInsightsTab(page);

  await ensureInsightsReady(page);

  // Period comparison section
  await expect(
    page.getByRole('heading', { name: /Period Comparison/i })
  ).toBeVisible();

  // Region breakdown shows seeded cities
  await expect(
    page.getByRole('heading', { name: 'Region Breakdown' })
  ).toBeVisible();
  await expect(page.getByText('Istanbul', { exact: false })).toBeVisible();
  await expect(page.getByText('Ankara', { exact: false })).toBeVisible();

  // Type breakdown shows formatted need types
  await expect(
    page.getByRole('heading', { name: 'Type / Category Breakdown' })
  ).toBeVisible();
  await expect(page.getByText('First Aid', { exact: false })).toBeVisible();

  // Daily trend section
  await expect(
    page.getByRole('heading', { name: /Daily Trend/i })
  ).toBeVisible();
});

test('admin sees retry state on analytics failure and recovers', async ({ page }) => {
  const email = `admin-insights-fail-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });
  const dbUser = await waitForUserByEmail(email);
  await promoteUserToAdmin({ userId: dbUser.user_id });

  // Seed at least one emergency so the recovered analytics has period activity
  // and the "Period Comparison" section actually renders (not the empty state).
  await seedEmergencyOverviewRecord({
    requestId: 'e2e_insights_retry_seed',
    status: 'PENDING',
    city: 'istanbul',
    needType: 'first_aid',
    createdAtHoursAgo: 2,
  });

  let failNext = true;
  await page.route('**/api/admin/emergency-analytics**', async (route) => {
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
  await openInsightsTab(page);

  await ensureInsightsReady(page);

  await expect(
    page.getByRole('heading', { name: /Period Comparison/i })
  ).toBeVisible({ timeout: 20_000 });
});

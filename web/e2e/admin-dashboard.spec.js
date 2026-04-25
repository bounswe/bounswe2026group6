const { test, expect } = require('@playwright/test');
const { createCompletedUser } = require('./helpers/api');
const {
  promoteUserToAdmin,
  resetDatabase,
  seedEmergencyOverviewRecord,
  waitForUserByEmail,
} = require('./helpers/db');
const { loginThroughUi } = require('./helpers/ui');

function getOverviewUiState(page) {
  const retryButton = page.getByRole('button', { name: 'Retry Overview' });
  const loadRegionButton = page.getByRole('button', { name: 'Load Region Summary' });
  const hideRegionButton = page.getByRole('button', { name: 'Hide Region Summary' });
  const url = page.url();

  if (/\/login(\?|$)/.test(url)) {
    return "redirected-login";
  }

  if (/\/home(\?|$)/.test(url)) {
    return "redirected-home";
  }

  return Promise.all([
    loadRegionButton.isVisible().catch(() => false),
    hideRegionButton.isVisible().catch(() => false),
    retryButton.isVisible().catch(() => false),
  ]).then(([isLoadVisible, isHideVisible, isRetryVisible]) => {
    if (isLoadVisible || isHideVisible) {
      return "ready";
    }

    if (isRetryVisible) {
      return "retry";
    }

    return "pending";
  });
}

async function ensureOverviewReady(page, { allowRetryClick = false } = {}) {
  const retryButton = page.getByRole('button', { name: 'Retry Overview' });
  const deadline = Date.now() + 30_000;
  let retryClicked = false;

  while (Date.now() < deadline) {
    const state = await getOverviewUiState(page);

    if (state === "ready") {
      return;
    }

    if (state === "redirected-login" || state === "redirected-home") {
      throw new Error(`Admin overview redirected unexpectedly. Current URL: ${page.url()}`);
    }

    if (state === "retry" && allowRetryClick && !retryClicked) {
      retryClicked = true;
      await retryButton.click({ timeout: 1500, force: true }).catch(() => {});
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Admin overview did not become ready. Current URL: ${page.url()}`);
}

async function readMetricValue(page, label) {
  const valueText = await page
    .locator('.admin-metric-tile', { hasText: label })
    .locator('.admin-metric-value')
    .first()
    .innerText();

  return Number.parseInt(valueText, 10);
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
  await ensureOverviewReady(page, { allowRetryClick: true });

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

test('aggregate metrics reflect mixed status and urgency records', async ({ page }) => {
  const email = `admin-metrics-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });
  const dbUser = await waitForUserByEmail(email);
  await promoteUserToAdmin({ userId: dbUser.user_id });

  await seedEmergencyOverviewRecord({
    requestId: 'e2e_mix_pending_low',
    status: 'PENDING',
    city: 'ankara',
    createdAtHoursAgo: 2,
    affectedPeopleCount: 1,
    riskFlags: [],
  });
  await seedEmergencyOverviewRecord({
    requestId: 'e2e_mix_progress_high',
    status: 'IN_PROGRESS',
    city: 'izmir',
    createdAtHoursAgo: 3,
    affectedPeopleCount: 6,
    riskFlags: ['injury', 'flood'],
  });
  await seedEmergencyOverviewRecord({
    requestId: 'e2e_mix_resolved_medium',
    status: 'RESOLVED',
    city: 'bursa',
    createdAtHoursAgo: 4,
    affectedPeopleCount: 2,
    riskFlags: ['injury'],
  });
  await seedEmergencyOverviewRecord({
    requestId: 'e2e_mix_cancelled_medium',
    status: 'CANCELLED',
    city: 'adana',
    createdAtHoursAgo: 5,
    affectedPeopleCount: 3,
    riskFlags: [],
  });

  await page.goto('/login');
  await loginThroughUi(page, { email, password });
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin$/);
  await ensureOverviewReady(page, { allowRetryClick: true });

  await expect.poll(async () => ({
    total: await readMetricValue(page, 'Total Emergencies'),
    active: await readMetricValue(page, 'Active'),
    resolved: await readMetricValue(page, 'Resolved'),
    closed: await readMetricValue(page, 'Closed'),
    pending: await readMetricValue(page, 'Pending'),
    inProgress: await readMetricValue(page, 'In Progress'),
    cancelled: await readMetricValue(page, 'Cancelled'),
    urgencyLow: await readMetricValue(page, 'Low'),
    urgencyMedium: await readMetricValue(page, 'Medium'),
    urgencyHigh: await readMetricValue(page, 'High'),
  })).toMatchObject({
    total: 4,
    active: 2,
    resolved: 1,
    closed: 2,
    pending: 1,
    inProgress: 1,
    cancelled: 1,
    urgencyLow: 1,
    urgencyMedium: 2,
    urgencyHigh: 1,
  });

  const activeOperationalTable = page
    .locator('section', {
      has: page.getByRole('heading', { name: 'Active Operational Snapshot' }),
    })
    .locator('table');

  await expect(activeOperationalTable).toContainText('In Progress');
  await expect(activeOperationalTable).toContainText('First Aid');
  await expect(activeOperationalTable).not.toContainText('IN_PROGRESS');
  await expect(activeOperationalTable).not.toContainText('In_progress');
  await expect(activeOperationalTable).not.toContainText('first_aid');
  await expect(activeOperationalTable).not.toContainText('First_aid');

  const activeRows = activeOperationalTable.locator('tbody tr');
  await expect(activeRows.first()).toContainText('In Progress');
  await expect(activeRows.first()).toContainText('High');
  await expect(activeRows.nth(1)).toContainText('Pending');
  await expect(activeRows.nth(1)).toContainText('Low');
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
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();

  let failUntilRetried = true;
  await page.route('**/*emergency-overview*', async (route) => {
    if (failUntilRetried) {
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
  await page.getByRole('button', { name: 'Retry Overview' }).waitFor({ state: 'visible', timeout: 30_000 });
  failUntilRetried = false;
  await ensureOverviewReady(page, { allowRetryClick: true });
});

const { test, expect } = require('@playwright/test');
const { createCompletedUser } = require('./helpers/api');
const {
  promoteUserToAdmin,
  resetDatabase,
  seedEmergencyOverviewRecord,
  waitForUserByEmail,
} = require('./helpers/db');
const { loginThroughUi } = require('./helpers/ui');

async function createAdminUserAndLogin(page, { email, password }) {
  await createCompletedUser({ email, password });
  const dbUser = await waitForUserByEmail(email);
  await promoteUserToAdmin({ userId: dbUser.user_id });

  await page.goto('/login');
  await loginThroughUi(page, { email, password });
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();
}

test.beforeEach(async () => {
  await resetDatabase();
});

test('admin can review closed emergency history records', async ({ page }) => {
  const email = `history-admin-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createAdminUserAndLogin(page, { email, password });

  await seedEmergencyOverviewRecord({
    requestId: 'e2e_hist_resolved_recent',
    status: 'RESOLVED',
    city: 'ankara',
    needType: 'first_aid',
    description: 'History resolved recent',
    createdAtHoursAgo: 2,
  });
  await seedEmergencyOverviewRecord({
    requestId: 'e2e_hist_cancelled_old',
    status: 'CANCELLED',
    city: 'izmir',
    needType: 'shelter',
    description: 'History cancelled old',
    createdAtHoursAgo: 5,
  });
  await seedEmergencyOverviewRecord({
    requestId: 'e2e_hist_pending',
    status: 'PENDING',
    city: 'ankara',
    needType: 'food',
    description: 'History pending should not show',
    createdAtHoursAgo: 1,
  });

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('tab', { name: 'Emergency History' }).click();
  await expect(page.getByRole('heading', { name: 'Emergency History' })).toBeVisible();

  const historyTable = page
    .locator('section', {
      has: page.getByRole('heading', { name: 'Emergency History' }),
    })
    .locator('table');

  await expect(historyTable).toBeVisible();
  await expect(historyTable).toContainText('History resolved recent');
  await expect(historyTable).toContainText('History cancelled old');
  await expect(historyTable).not.toContainText('History pending should not show');
  await expect(historyTable).toContainText('First Aid');
  await expect(historyTable).not.toContainText('first_aid');
  await expect(historyTable).not.toContainText('First_aid');
  await expect(historyTable).toContainText('Resolved');
  await expect(historyTable).toContainText('Cancelled');
  await expect(historyTable.locator('tbody tr').first().locator('td').nth(6)).toHaveText(/^[0-9]+$/);
  await expect(page.getByText('Showing 2 of 2 closed emergencies.')).toBeVisible();
});

test('admin history filters by status city type and handles empty result state', async ({ page }) => {
  const email = `history-filter-admin-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createAdminUserAndLogin(page, { email, password });

  await seedEmergencyOverviewRecord({
    requestId: 'e2e_hist_filter_resolved',
    status: 'RESOLVED',
    city: 'ankara',
    needType: 'water',
    description: 'History filter resolved',
    createdAtHoursAgo: 4,
    affectedPeopleCount: 1,
    riskFlags: [],
  });
  await seedEmergencyOverviewRecord({
    requestId: 'e2e_hist_filter_cancelled',
    status: 'CANCELLED',
    city: 'izmir',
    needType: 'shelter',
    description: 'History filter cancelled',
    createdAtHoursAgo: 3,
    affectedPeopleCount: 6,
    riskFlags: ['injury', 'flood'],
  });

  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Emergency History' }).click();
  await expect(page.getByRole('heading', { name: 'Emergency History' })).toBeVisible();

  await page.selectOption('#history-status', 'CANCELLED');
  await page.selectOption('#history-urgency', 'HIGH');
  await page.fill('#history-city', 'izmir');
  await page.fill('#history-type', 'shelter');
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  const historyTable = page
    .locator('section', {
      has: page.getByRole('heading', { name: 'Emergency History' }),
    })
    .locator('table');

  await expect(historyTable).toContainText('History filter cancelled');
  await expect(historyTable).not.toContainText('History filter resolved');
  await expect(page.getByText('Showing 1 of 1 closed emergencies.')).toBeVisible();

  await page.fill('#history-city', 'trabzon');
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect(page.getByText('No past emergencies matched the current filters.')).toBeVisible();
});

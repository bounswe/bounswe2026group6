const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('./helpers/db');

test.beforeEach(async () => {
  await resetDatabase();
});

test('guest can view waiting help requests on the map without operational status details', async ({ page }) => {
  let requestedUrl = '';

  await page.route('**/api/help-requests/active**', async (route) => {
    requestedUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        requests: [
          {
            requestId: 'map_req_first_aid',
            type: 'first_aid',
            status: 'PENDING',
            urgencyLevel: 'HIGH',
            createdAt: '2026-05-01T10:15:00.000Z',
            assignmentState: 'UNASSIGNED',
            location: {
              latitude: 41.043,
              longitude: 29.009,
              city: 'istanbul',
              district: 'besiktas',
            },
          },
          {
            requestId: 'map_req_shelter',
            type: 'shelter',
            status: 'PENDING',
            urgencyLevel: 'MEDIUM',
            createdAt: '2026-05-01T10:05:00.000Z',
            assignmentState: 'UNASSIGNED',
            location: {
              latitude: 41.066,
              longitude: 28.993,
              city: 'istanbul',
              district: 'sisli',
            },
          },
          {
            requestId: 'map_req_assigned',
            type: 'search_and_rescue',
            status: 'PENDING',
            urgencyLevel: 'HIGH',
            createdAt: '2026-05-01T09:55:00.000Z',
            assignmentState: 'ASSIGNED',
            location: {
              latitude: 41.079,
              longitude: 29.022,
              city: 'istanbul',
              district: 'sariyer',
            },
          },
        ],
        total: 3,
        pagination: { limit: 300, offset: 0 },
      }),
    });
  });

  await page.goto('/crisis-map');

  await expect(page.getByRole('heading', { name: 'Help Request Map' })).toBeVisible();
  await expect(page.getByText('Showing waiting help requests by type and priority.')).toBeVisible();
  await expect(page.getByRole('button', { name: /First Aid/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Shelter/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Search and Rescue/i })).toHaveCount(0);
  await expect(page.locator('.crisis-pin')).toHaveCount(2);
  await expect(page.locator('.gathering-areas-selected-card')).toContainText('Priority: High');
  await expect(page.getByText('PENDING')).toHaveCount(0);
  await expect(page.getByText('ASSIGNED')).toHaveCount(0);

  await page.locator('.crisis-pin').nth(1).click();
  await expect(page.locator('.gathering-areas-selected-card')).toContainText('Shelter');
  await expect(page.locator('.gathering-areas-selected-card')).toContainText('Priority: Medium');

  const url = new URL(requestedUrl);
  expect(url.searchParams.get('status')).toBe('PENDING');
  expect(url.searchParams.get('limit')).toBe('300');

  await page.locator('.crisis-pin').first().hover();
  await expect(page.locator('.crisis-tooltip-card').filter({ hasText: 'Priority: High' })).toBeVisible();
});

test('shows empty state and supports refresh after active request lookup fails', async ({ page }) => {
  let requestCount = 0;

  await page.route('**/api/help-requests/active**', async (route) => {
    requestCount += 1;

    if (requestCount === 1) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          requests: [],
          total: 0,
          pagination: { limit: 300, offset: 0 },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Help request visibility is temporarily unavailable',
      }),
    });
  });

  await page.goto('/crisis-map');

  await expect(page.getByText('No waiting requests in view.')).toBeVisible();

  await page.getByRole('button', { name: 'Refresh Help Request Map' }).click();

  await expect(page.getByText('Help request visibility is temporarily unavailable')).toBeVisible();
  await expect.poll(() => requestCount).toBe(2);
});

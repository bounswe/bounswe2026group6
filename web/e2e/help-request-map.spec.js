const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('./helpers/db');

function mockGeolocation(page, latitude = 41.009, longitude = 28.97) {
  return page.addInitScript(
    ({ lat, lon }) => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (success) => {
            success({
              coords: {
                latitude: lat,
                longitude: lon,
                accuracy: 12,
              },
            });
          },
        },
      });
    },
    { lat: latitude, lon: longitude }
  );
}

test.beforeEach(async () => {
  await resetDatabase();
});

test('guest can view waiting help requests on the map without operational status details', async ({ page }) => {
  await mockGeolocation(page);

  let requestedUrl = '';
  const list = page.locator('.gathering-areas-list');

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
            type: 'search_rescue',
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
  await expect(list.getByRole('button', { name: /First Aid/i })).toBeVisible();
  await expect(list.getByRole('button', { name: /Shelter/i })).toBeVisible();
  await expect(list.getByRole('button', { name: /Search and Rescue/i })).toHaveCount(0);
  await expect(page.locator('.crisis-pin')).toHaveCount(2);
  await expect(page.getByText('Select a request marker to view details.')).toBeVisible();

  await list.getByRole('button', { name: /First Aid/i }).click();
  await expect(page.locator('.crisis-pin.is-selected')).toHaveCount(1);
  await expect(page.locator('.gathering-areas-selected-card')).toContainText('Priority: High');
  await expect(page.getByText('PENDING')).toHaveCount(0);
  await expect(page.getByText('ASSIGNED')).toHaveCount(0);

  await list.getByRole('button', { name: /Shelter/i }).click();
  await expect(page.locator('.crisis-pin.is-selected')).toHaveCount(1);
  await expect(page.locator('.gathering-areas-selected-card')).toContainText('Shelter');
  await expect(page.locator('.gathering-areas-selected-card')).toContainText('Priority: Medium');

  const url = new URL(requestedUrl);
  expect(url.searchParams.get('status')).toBe('PENDING');
  expect(url.searchParams.get('limit')).toBe('300');
});

test('shows empty state and supports refresh after active request lookup fails', async ({ page }) => {
  await mockGeolocation(page);

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
  await expect(
    page
      .locator('.gathering-areas-status-box')
      .filter({ hasText: 'No resources were found in this visible area.' })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Refresh Help Request Map' }).click();
  await expect(page.locator('.gathering-areas-status-box.is-error')).toContainText(
    'Help request visibility is temporarily unavailable'
  );
  await expect.poll(() => requestCount).toBeGreaterThan(1);
});

test('supports multi-select request type filters and clears selected details when filtered out', async ({ page }) => {
  await mockGeolocation(page);

  const filters = page.locator('.crisis-filters-panel');
  const list = page.locator('.gathering-areas-list');
  await page.route('**/api/help-requests/active**', async (route) => {
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
            location: { latitude: 41.043, longitude: 29.009, city: 'istanbul', district: 'besiktas' },
          },
          {
            requestId: 'map_req_shelter',
            type: 'shelter',
            status: 'PENDING',
            urgencyLevel: 'MEDIUM',
            createdAt: '2026-05-01T10:05:00.000Z',
            assignmentState: 'UNASSIGNED',
            location: { latitude: 41.066, longitude: 28.993, city: 'istanbul', district: 'sisli' },
          },
          {
            requestId: 'map_req_search_rescue',
            type: 'search_rescue',
            status: 'PENDING',
            urgencyLevel: 'HIGH',
            createdAt: '2026-05-01T11:00:00.000Z',
            assignmentState: 'UNASSIGNED',
            location: { latitude: 41.05, longitude: 29.01, city: 'istanbul', district: 'kadikoy' },
          },
          {
            requestId: 'map_req_food',
            type: 'food_water',
            status: 'PENDING',
            urgencyLevel: 'LOW',
            createdAt: '2026-05-01T11:05:00.000Z',
            assignmentState: 'UNASSIGNED',
            location: { latitude: 41.052, longitude: 29.012, city: 'istanbul', district: 'kadikoy' },
          },
        ],
        total: 4,
        pagination: { limit: 300, offset: 0 },
      }),
    });
  });

  await page.goto('/crisis-map');
  await expect(page.locator('.crisis-pin')).toHaveCount(4);
  await expect(page.getByText('Select a request marker to view details.')).toBeVisible();
  await expect(list.getByRole('button', { name: /Search and Rescue/i })).toBeVisible();
  await expect(list.getByRole('button', { name: /Other \/ Unknown/i })).toHaveCount(0);

  await list.getByRole('button', { name: /First Aid/i }).click();
  await expect(page.locator('.crisis-pin.is-selected')).toHaveCount(1);
  await expect(page.locator('.gathering-areas-selected-card')).toContainText('First Aid');

  await filters.getByRole('button', { name: 'Search and Rescue', exact: true }).click();
  await expect(page.locator('.crisis-pin')).toHaveCount(1);
  await expect(list.getByRole('button', { name: /Search and Rescue/i })).toBeVisible();
  await expect(list.getByRole('button', { name: /First Aid/i })).toHaveCount(0);

  await filters.getByRole('button', { name: 'Search and Rescue', exact: true }).click();
  await filters.getByRole('button', { name: 'Shelter', exact: true }).click();
  await filters.getByRole('button', { name: 'Food / Water Supplies', exact: true }).click();
  await expect(page.locator('.crisis-pin')).toHaveCount(2);
  await expect(page.getByText('Select a request marker to view details.')).toBeVisible();

  await list.getByRole('button', { name: /Shelter/i }).click();
  await expect(page.locator('.crisis-pin.is-selected')).toHaveCount(1);
  await expect(page.locator('.gathering-areas-selected-card')).toContainText('Shelter');
  await expect(list.getByRole('button', { name: /First Aid/i })).toHaveCount(0);

  await filters.getByRole('button', { name: 'Shelter', exact: true }).click();
  await filters.getByRole('button', { name: 'Food / Water Supplies', exact: true }).click();
  await expect(page.locator('.crisis-pin')).toHaveCount(4);
  await expect(list.getByRole('button', { name: /First Aid/i })).toBeVisible();

  await filters.getByRole('button', { name: 'Other / Unknown', exact: true }).click();
  await expect(page.getByText('No help requests match the selected request type filters.')).toBeVisible();
  await expect(page.getByText('Select a request marker to view details.')).toBeVisible();

  await filters.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.locator('.crisis-pin')).toHaveCount(4);
});

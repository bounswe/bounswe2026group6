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

function mockGeolocationPending(page) {
  return page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success, _error) => {
        },
      },
    });
  });
}

function mockGeolocationDenied(page) {
  return page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success, error) => {
          error({ code: 1, message: 'Permission denied' });
        },
      },
    });
  });
}

test.beforeEach(async () => {
  await resetDatabase();
});

test('keeps map/list selection stable when features share same id but different osmType', async ({ page }) => {
  await mockGeolocation(page);

  await page.route('**/api/gathering-areas/viewport**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        center: { lat: 41.009, lon: 28.97 },
        radius: 2000,
        source: 'overpass',
        meta: { requestedLimit: 20, returnedCount: 2 },
        collection: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [28.975, 41.01],
              },
              properties: {
                id: '12345',
                osmType: 'node',
                name: 'Park Assembly Point',
                category: 'assembly_point',
                distanceMeters: 120,
                rawTags: {},
              },
            },
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [28.982, 41.015],
              },
              properties: {
                id: '12345',
                osmType: 'way',
                name: 'City Hall Shelter',
                category: 'shelter',
                distanceMeters: 300,
                rawTags: {},
              },
            },
          ],
        },
      }),
    });
  });

  await page.goto('/gathering-areas');

  await expect(page.getByRole('heading', { name: 'Gathering Areas' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Park Assembly Point/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /City Hall Shelter/i })).toBeVisible();

  await page.getByRole('button', { name: /City Hall Shelter/i }).click();

  await expect(page.locator('.gathering-areas-selected-name')).toHaveText('City Hall Shelter');
  await expect(page.locator('.gathering-areas-selected-meta').first()).toContainText('Shelter');
});

test('shows empty state and then error state for gathering areas retrieval', async ({ page }) => {
  await mockGeolocation(page);

  let requestCount = 0;
  await page.route('**/api/gathering-areas/viewport**', async (route) => {
    requestCount += 1;

    if (requestCount === 1) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          center: { lat: 41.009, lon: 28.97 },
          radius: 2000,
          source: 'overpass',
          meta: { requestedLimit: 20, returnedCount: 0 },
          collection: {
            type: 'FeatureCollection',
            features: [],
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'OVERPASS_UNAVAILABLE',
        message: 'Gathering areas provider is unavailable',
      }),
    });
  });

  await page.goto('/gathering-areas');

  await expect(page.getByText('No resources were found in this visible area.')).toBeVisible();

  await page.getByRole('button', { name: 'Retry Results' }).click();

  await expect(page.getByText('Gathering areas provider is unavailable')).toBeVisible();
  await expect(page.getByText('Could not load nearby results.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Demo central assembly area/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry Results' })).toBeVisible();
});

test('renders non-empty fallback-source response without warning banner', async ({ page }) => {
  await mockGeolocation(page);

  await page.route('**/api/gathering-areas/viewport**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        center: { lat: 41.009, lon: 28.97 },
        radius: 2000,
        source: 'fallback',
        meta: {
          requestedLimit: 20,
          returnedCount: 1,
          fallbackReason: 'Overpass provider timed out.',
        },
        collection: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [28.976, 41.011],
              },
              properties: {
                id: 'backend-fallback-assembly',
                osmType: 'fallback',
                name: 'Backend fallback assembly point',
                category: 'assembly_point',
                distanceMeters: 180,
                rawTags: {
                  address: 'Backend fallback address',
                },
              },
            },
          ],
        },
      }),
    });
  });

  await page.goto('/gathering-areas');

  await expect(page.getByRole('button', { name: /Backend fallback assembly point/i })).toBeVisible();
  await expect(page.getByText('Using backend fallback gathering areas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry Results' })).toBeVisible();
});

test('does not show false empty state while geolocation is still pending', async ({ page }) => {
  await mockGeolocationPending(page);

  let requestCount = 0;
  await page.route('**/api/gathering-areas/viewport**', async (route) => {
    requestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        center: { lat: 41.009, lon: 28.97 },
        radius: 2000,
        source: 'overpass',
        meta: { requestedLimit: 20, returnedCount: 0 },
        collection: {
          type: 'FeatureCollection',
          features: [],
        },
      }),
    });
  });

  await page.goto('/gathering-areas');

  await expect(page.getByText('Resolving your current location...')).toBeVisible();
  await expect(page.getByText('No resources were found in this visible area.')).toHaveCount(0);
  await expect.poll(() => requestCount).toBe(0);
});

test('uses fallback location flow when geolocation is denied', async ({ page }) => {
  await mockGeolocationDenied(page);

  let requestCount = 0;
  await page.route('**/api/gathering-areas/viewport**', async (route) => {
    requestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        center: { lat: 41.0082, lon: 28.9784 },
        radius: 2000,
        source: 'overpass',
        meta: { requestedLimit: 20, returnedCount: 0 },
        collection: {
          type: 'FeatureCollection',
          features: [],
        },
      }),
    });
  });

  await page.goto('/gathering-areas');

  await expect(page.getByText('Location permission was denied or unavailable. Continue by moving the map manually.')).toBeVisible();
  await expect(page.getByText('No resources were found in this visible area.')).toHaveCount(0);
  await expect.poll(() => requestCount).toBe(0);
});

test('supports multi-select category filters and clear filters reset', async ({ page }) => {
  await mockGeolocation(page);

  await page.route('**/api/gathering-areas/viewport**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        center: { lat: 41.009, lon: 28.97 },
        radius: 2000,
        source: 'overpass',
        meta: {
          requestedLimit: 20,
          returnedCount: 3,
          categories: [
            { key: 'assembly_point', label: 'Assembly Point' },
            { key: 'hospital', label: 'Hospital' },
            { key: 'police', label: 'Police Station' },
          ],
        },
        collection: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [28.975, 41.01] },
              properties: {
                id: 'a1',
                osmType: 'node',
                name: 'Assembly Alpha',
                category: 'assembly_point',
                categoryLabel: 'Assembly Point',
                distanceMeters: 120,
                rawTags: {},
              },
            },
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [28.982, 41.015] },
              properties: {
                id: 'h1',
                osmType: 'node',
                name: 'Hospital Beta',
                category: 'hospital',
                categoryLabel: 'Hospital',
                distanceMeters: 300,
                rawTags: {},
              },
            },
          ]
        },
      }),
    });
  });

  await page.goto('/gathering-areas');
  await expect(page.getByRole('button', { name: /Assembly Alpha/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Hospital Beta/i })).toBeVisible();
  const filterPanel = page.locator('.crisis-filters-panel');

  await filterPanel.getByRole('button', { name: 'Hospital', exact: true }).click();
  await expect(page.getByRole('button', { name: /Hospital Beta/i })).toHaveCount(0);

  await filterPanel.getByRole('button', { name: 'Assembly Point', exact: true }).click();
  await expect(page.getByRole('button', { name: /Assembly Alpha/i })).toHaveCount(0);

  await expect(page.getByText('No results match the selected categories.')).toBeVisible();

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByRole('button', { name: /Assembly Alpha/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Hospital Beta/i })).toBeVisible();
});

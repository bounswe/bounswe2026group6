const { test, expect } = require('@playwright/test');
const { createCompletedUser } = require('./helpers/api');
const { resetDatabase } = require('./helpers/db');
const { loginThroughUi } = require('./helpers/ui');

async function loginToProtectedRoute(page, route, { email, password }) {
  await page.goto(route);
  await expect(page).toHaveURL(new RegExp(`/login\\?returnTo=${encodeURIComponent(route)}$`));
  await loginThroughUi(page, { email, password });
  await expect(page).toHaveURL(new RegExp(`${route}$`));
}

function buildMockLocationTree() {
  return {
    countryCode: 'TR',
    tree: {
      label: 'Turkey',
      cities: {
        istanbul: {
          label: 'Istanbul',
          districts: {
            besiktas: {
              label: 'Besiktas',
              neighborhoods: [
                {
                  label: 'Levent',
                  value: 'levent',
                },
              ],
            },
            kadikoy: {
              label: 'Kadikoy',
              neighborhoods: [
                {
                  label: 'Bostanci',
                  value: 'bostanci',
                },
              ],
            },
          },
        },
      },
    },
    meta: {
      cityCount: 1,
      districtCount: 2,
      neighborhoodCount: 2,
    },
  };
}

function buildLeventSearchItem() {
  return {
    placeId: 'mock:levent',
    displayName: 'Levent, Besiktas, Istanbul, Turkey',
    latitude: 41.0822,
    longitude: 29.0154,
    administrative: {
      countryCode: 'TR',
      country: 'Turkey',
      city: 'Istanbul',
      district: 'Besiktas',
      neighborhood: 'Levent',
      extraAddress: '',
      postalCode: '34330',
    },
  };
}

function buildStreetSearchItem() {
  return {
    placeId: 'mock:buyukdere-45',
    displayName: 'Buyukdere Cd. 45, Levent, Besiktas, Istanbul, Turkey',
    latitude: 41.0831,
    longitude: 29.0145,
    administrative: {
      countryCode: 'TR',
      country: 'Turkey',
      city: 'Istanbul',
      district: 'Besiktas',
      neighborhood: 'Levent',
      extraAddress: 'Buyukdere Cd. 45',
      postalCode: '34330',
    },
  };
}

async function mockLocationApis(page) {
  await page.route('**/location/tree**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildMockLocationTree()),
    });
  });

  await page.route('**/location/reverse**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        item: buildLeventSearchItem(),
      }),
    });
  });

  await page.route('**/location/search**', async (route) => {
    const requestUrl = new URL(route.request().url());
    const query = (requestUrl.searchParams.get('q') || '').toLowerCase();

    const streetItem = buildStreetSearchItem();
    const areaItem = buildLeventSearchItem();

    const responseItems =
      query.includes('buyukdere') || query.includes('buyukdere cd')
        ? [streetItem]
        : query.includes('levent') || query.includes('besiktas')
          ? [areaItem]
          : [];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: responseItems,
      }),
    });
  });
}

test.beforeEach(async () => {
  await resetDatabase();
});

test('map pin selection updates country-city-district dropdowns', async ({ page }) => {
  const email = `profile-map-sync-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });
  await mockLocationApis(page);
  await loginToProtectedRoute(page, '/profile', { email, password });

  const map = page.locator('.leaflet-container').first();
  await expect(map).toBeVisible();

  await map.click({ position: { x: 120, y: 120 } });

  await expect(
    page.getByText('Selected: Levent, Besiktas, Istanbul, Turkey')
  ).toBeVisible();

  await expect(page.locator('#country')).toHaveValue('tr');
  await expect(page.locator('#city')).toHaveValue('istanbul');
  await expect(page.locator('#district')).toHaveValue('besiktas');
});

test('dropdown selection updates map selected location', async ({ page }) => {
  const email = `profile-dropdown-sync-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });
  await mockLocationApis(page);
  await loginToProtectedRoute(page, '/profile', { email, password });

  await page.locator('#country').selectOption('tr');
  await page.locator('#city').selectOption('istanbul');
  await page.locator('#district').selectOption('besiktas');
  await page.locator('#neighborhood').selectOption('levent');

  await expect(
    page.getByText('Selected: Levent, Besiktas, Istanbul, Turkey')
  ).toBeVisible();
});

test('extra address autocomplete selection updates map pin', async ({ page }) => {
  const email = `profile-street-sync-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });
  await mockLocationApis(page);
  await loginToProtectedRoute(page, '/profile', { email, password });

  await page.locator('#country').selectOption('tr');
  await page.locator('#city').selectOption('istanbul');
  await page.locator('#district').selectOption('besiktas');

  const extraAddressInput = page.locator('#extraAddress');
  await extraAddressInput.fill('Buyukdere');

  const suggestion = page.getByRole('option', {
    name: 'Buyukdere Cd. 45, Levent, Besiktas, Istanbul, Turkey',
  });

  await expect(suggestion).toBeVisible();
  await suggestion.click();

  await expect(extraAddressInput).toHaveValue('Buyukdere Cd. 45');
  await expect(
    page.getByText('Selected: Buyukdere Cd. 45, Levent, Besiktas, Istanbul, Turkey')
  ).toBeVisible();
});

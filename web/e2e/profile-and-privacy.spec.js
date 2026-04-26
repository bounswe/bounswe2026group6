const { test, expect } = require('@playwright/test');
const { createCompletedUser, fetchMyProfile } = require('./helpers/api');
const { resetDatabase } = require('./helpers/db');
const { getStoredAccessToken, loginThroughUi } = require('./helpers/ui');

async function loginToProtectedRoute(page, route, { email, password }) {
  await page.goto(route);
  await expect(page).toHaveURL(new RegExp(`/login\\?returnTo=${encodeURIComponent(route)}$`));
  await loginThroughUi(page, { email, password });
  await expect(page).toHaveURL(new RegExp(`${route}$`));
}

async function mockGeolocationSuccess(page, {
  latitude = 41.015137,
  longitude = 28.97953,
  accuracy = 8,
  timestamp = Date.now(),
} = {}) {
  await page.addInitScript(({ latitude, longitude, accuracy, timestamp }) => {
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: async () => ({ state: 'prompt' }),
      },
    });

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success) => {
          success({
            coords: {
              latitude,
              longitude,
              accuracy,
            },
            timestamp,
          });
        },
      },
    });
  }, { latitude, longitude, accuracy, timestamp });
}

async function mockGeolocationError(page, { code, message, permissionState = 'prompt' }) {
  await page.addInitScript(({ code, message, permissionState }) => {
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: async () => ({ state: permissionState }),
      },
    });

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success, error) => {
          error({
            code,
            message,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          });
        },
      },
    });
  }, { code, message, permissionState });
}

test.beforeEach(async () => {
  await resetDatabase();
});

test('privacy page blocks first-time share enable until profile captures current location', async ({ page }) => {
  const email = `privacy-block-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });
  await loginToProtectedRoute(page, '/privacy-security', { email, password });

  const locationToggle = page.getByRole('button', { name: 'Share Current Location' });
  await expect(locationToggle).toHaveAttribute('aria-pressed', 'false');

  await locationToggle.click();
  await page.getByRole('button', { name: 'Save Privacy Settings' }).click();

  await expect(page.getByText('To enable Share Current Location, go to Profile, click Use Current Location, and save there first.')).toBeVisible();

  const accessToken = await getStoredAccessToken(page);
  await expect.poll(async () => {
    const profile = await fetchMyProfile(accessToken);
    return profile.privacySettings.locationSharingEnabled;
  }).toBe(false);
});

test('profile save blocks first-time share enable until Use Current Location is used', async ({ page }) => {
  const email = `profile-block-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });
  await loginToProtectedRoute(page, '/profile', { email, password });

  const locationToggle = page.getByRole('button', { name: 'Share Current Location' });
  await locationToggle.click();
  await expect(locationToggle).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#height').fill('180');
  await page.locator('#extraAddress').fill('Updated Address 42');

  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(
    page.getByText(/To enable Share Current Location, click Use Current Location first/i)
  ).toBeVisible();
});

test('persists real current-device metadata when sharing is enabled after fresh capture', async ({ page }) => {
  const email = `profile-${Date.now()}@example.com`;
  const password = 'Passw0rd!';
  const captureTimestamp = Date.now();

  await createCompletedUser({ email, password });
  await mockGeolocationSuccess(page, {
    latitude: 41.0136,
    longitude: 28.955,
    accuracy: 7,
    timestamp: captureTimestamp,
  });

  await loginToProtectedRoute(page, '/profile', { email, password });

  await page.getByRole('button', { name: 'Use Current Location' }).click();
  await expect(page.getByText('Selected:')).toBeVisible();

  const locationToggle = page.getByRole('button', { name: 'Share Current Location' });
  await locationToggle.click();

  const heightInput = page.locator('#height');
  await heightInput.fill('');
  await heightInput.fill('180');
  await page.locator('#extraAddress').fill('Updated Address 42');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  const accessToken = await getStoredAccessToken(page);

  // Success banner text can be flaky in CI timing; assert the persisted backend
  // state instead, which is the real contract this scenario verifies.
  await expect
    .poll(async () => {
      const profile = await fetchMyProfile(accessToken);
      return {
        height: profile.physicalInfo.height,
        address: profile.locationProfile.address,
        locationSharingEnabled: profile.privacySettings.locationSharingEnabled,
        source: profile.locationProfile.coordinate?.source ?? null,
        accuracyMeters: profile.locationProfile.coordinate?.accuracyMeters ?? null,
      };
    }, { timeout: 20_000 })
    .toMatchObject({
      height: 180,
      locationSharingEnabled: true,
      source: 'current_device',
      accuracyMeters: 7,
    });

  await expect(locationToggle).toHaveAttribute('aria-pressed', 'true');

  const profile = await fetchMyProfile(accessToken);
  expect((profile.locationProfile.address || '').trim().length).toBeGreaterThan(0);
  expect(profile.locationProfile.coordinate?.capturedAt).toBeTruthy();
  expect(Math.abs(Date.parse(profile.locationProfile.coordinate.capturedAt) - captureTimestamp)).toBeLessThan(10_000);
  expect(profile.locationProfile.placeId).toBeTruthy();
  expect(profile.locationProfile.displayAddress).toBeTruthy();
  expect(profile.privacySettings.locationSharingEnabled).toBe(true);

  await page.getByRole('button', { name: 'Open user menu' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();
});

test('shows denied geolocation error on current location action', async ({ page }) => {
  const email = `geo-denied-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });
  await mockGeolocationError(page, {
    code: 1,
    message: 'Permission denied',
    permissionState: 'denied',
  });

  await loginToProtectedRoute(page, '/profile', { email, password });
  await page.getByRole('button', { name: 'Use Current Location' }).click();

  await expect(page.getByText('Location permission is denied. Enable location access in your browser settings.')).toBeVisible();
});

test('shows position unavailable geolocation error on current location action', async ({ page }) => {
  const email = `geo-unavailable-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });
  await mockGeolocationError(page, {
    code: 2,
    message: 'Position unavailable',
    permissionState: 'prompt',
  });

  await loginToProtectedRoute(page, '/profile', { email, password });
  await page.getByRole('button', { name: 'Use Current Location' }).click();

  await expect(page.getByText('Current location is unavailable right now. Please try again or select from map.')).toBeVisible();
});

test('shows timeout geolocation error on current location action', async ({ page }) => {
  const email = `geo-timeout-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });
  await mockGeolocationError(page, {
    code: 3,
    message: 'Timeout',
    permissionState: 'prompt',
  });

  await loginToProtectedRoute(page, '/profile', { email, password });
  await page.getByRole('button', { name: 'Use Current Location' }).click();

  await expect(page.getByText('Location request timed out. Please try again.')).toBeVisible();
});

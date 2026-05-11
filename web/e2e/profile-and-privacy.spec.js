const { test, expect } = require('@playwright/test');
const { createCompletedUser, createVerifiedUser, fetchMyProfile } = require('./helpers/api');
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

async function expectNoWrittenCurrentLocationButton(page) {
  await expect(page.locator('button', { hasText: 'Use Current Location' })).toHaveCount(0);
}

test.beforeEach(async () => {
  await resetDatabase();
});

test('privacy page owns location sharing and hides health visibility', async ({ page }) => {
  const email = `privacy-location-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });
  await loginToProtectedRoute(page, '/privacy-security', { email, password });

  await expect(page.getByText('Health information visibility')).toHaveCount(0);
  await expect(page.getByText(/Used to make your current or saved location available/i)).toBeVisible();

  const locationToggle = page.getByRole('button', { name: 'Share Current Location' });
  await expect(locationToggle).toHaveAttribute('aria-pressed', 'false');

  await locationToggle.click();
  await page.getByRole('button', { name: 'Save Privacy Settings' }).click();
  await expect(locationToggle).toHaveAttribute('aria-pressed', 'true');

  const accessToken = await getStoredAccessToken(page);
  await expect.poll(async () => {
    const profile = await fetchMyProfile(accessToken);
    return profile.privacySettings.locationSharingEnabled;
  }).toBe(true);
});

test('profile edit no longer exposes Share Current Location control', async ({ page }) => {
  const email = `profile-no-share-toggle-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createCompletedUser({ email, password });
  await loginToProtectedRoute(page, '/profile', { email, password });

  await expect(page.getByRole('button', { name: 'Share Current Location' })).toHaveCount(0);
  await expectNoWrittenCurrentLocationButton(page);

  await page.locator('#height').fill('180');
  await page.locator('#extraAddress').fill('Updated Address 42');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  const accessToken = await getStoredAccessToken(page);
  await expect.poll(async () => {
    const profile = await fetchMyProfile(accessToken);
    return profile.privacySettings.locationSharingEnabled;
  }).toBe(false);
});

test('complete profile location picker initializes from current location without written button', async ({ page }) => {
  const email = `complete-profile-map-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await createVerifiedUser({ email, password });
  await mockGeolocationSuccess(page, {
    latitude: 41.0136,
    longitude: 28.955,
    accuracy: 7,
  });

  await loginToProtectedRoute(page, '/complete-profile', { email, password });

  await expectNoWrittenCurrentLocationButton(page);
  await expect(page.getByRole('button', { name: 'Use Current Location' })).toBeVisible();
  await expect(page.getByText('Selected:')).toBeVisible();
});

test('privacy page enables sharing after profile saves real current-device metadata', async ({ page }) => {
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

  await expectNoWrittenCurrentLocationButton(page);
  await page.getByRole('button', { name: 'Use Current Location' }).click();
  await expect(page.getByText('Selected:')).toBeVisible();

  const heightInput = page.locator('#height');
  await heightInput.fill('');
  await heightInput.fill('180');
  await page.locator('#extraAddress').fill('Updated Address 42');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  const accessToken = await getStoredAccessToken(page);

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
      locationSharingEnabled: false,
      source: 'current_device',
      accuracyMeters: 7,
    });

  await page.goto('/privacy-security');
  await expect(page.getByText(/Used to make your current or saved location available/i)).toBeVisible();

  const locationToggle = page.getByRole('button', { name: 'Share Current Location' });
  await locationToggle.click();
  await page.getByRole('button', { name: 'Save Privacy Settings' }).click();
  await expect(locationToggle).toHaveAttribute('aria-pressed', 'true');

  await expect.poll(async () => {
    const profile = await fetchMyProfile(accessToken);
    return profile.privacySettings.locationSharingEnabled;
  }).toBe(true);

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
  await expectNoWrittenCurrentLocationButton(page);
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
  await expectNoWrittenCurrentLocationButton(page);
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
  await expectNoWrittenCurrentLocationButton(page);
  await page.getByRole('button', { name: 'Use Current Location' }).click();

  await expect(page.getByText('Location request timed out. Please try again.')).toBeVisible();
});

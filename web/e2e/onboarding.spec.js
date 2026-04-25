const { test, expect } = require('@playwright/test');
const { waitForUserByEmail, resetDatabase } = require('./helpers/db');
const { createEmailVerificationToken, fetchMyProfile } = require('./helpers/api');
const { getStoredAccessToken, signupThroughUi } = require('./helpers/ui');

test.beforeEach(async () => {
  await resetDatabase();
});

test('new user can sign up, verify email, complete their profile, and see persisted data', async ({ page }) => {
  const email = `onboarding-${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  await page.goto('/signup');
  await signupThroughUi(page, { email, password });

  await expect(page).toHaveURL(/\/verify-email\?email=/);
  await expect(page.getByRole('heading', { name: 'Verify Email' })).toBeVisible();

  const createdUser = await waitForUserByEmail(email);
  const verificationToken = createEmailVerificationToken({
    userId: createdUser.user_id,
    email,
  });

  await page.goto(
    `/verify-email?token=${encodeURIComponent(verificationToken)}&email=${encodeURIComponent(email)}`
  );

  await expect(page).toHaveURL(/\/complete-profile$/);
  await expect(page.getByRole('heading', { name: 'Complete Your Profile' })).toBeVisible();

  await page.locator('#fullName').fill('Jane Onboard');
  await page.locator('#phone').fill('5551234567');
  await page.locator('#height').fill('168');
  await page.locator('#weight').fill('58');
  await page.locator('#gender').selectOption('female');
  await page.locator('#age').fill('27');
  await page.locator('#bloodType').selectOption('a_pos');
  await page.locator('#medicalHistory').fill('Seasonal asthma');
  await page.locator('#profession').selectOption('Engineer');
  await page.getByLabel('First Aid').check();
  await page.locator('#country').selectOption('tr');
  await page.locator('#city').selectOption('istanbul');
  await page.locator('#district').selectOption('kadikoy');
  const neighborhoodValue = await page.locator('#neighborhood option').evaluateAll((options) => {
    return options
      .map((option) => option.value)
      .find((value) => value && value.trim().length > 0) || null;
  });

  expect(neighborhoodValue).toBeTruthy();
  await page.locator('#neighborhood').selectOption(neighborhoodValue);
  await page.locator('#extraAddress').fill('Test Apartment 7');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('Jane Onboard')).toBeVisible();
  await expect(page.locator('p, span').filter({ hasText: email }).first()).toBeVisible();

  const accessToken = await getStoredAccessToken(page);
  const profile = await fetchMyProfile(accessToken);

  expect(profile.profile.firstName).toBe('Jane');
  expect(profile.profile.lastName).toBe('Onboard');
  expect(profile.profile.phoneNumber).toBe('+905551234567');
  expect(profile.physicalInfo.height).toBe(168);
  expect(profile.physicalInfo.weight).toBe(58);
  expect(profile.healthInfo.bloodType).toBe('a_pos');
  expect(profile.locationProfile.country).toBe('Turkey');
  expect(profile.locationProfile.city?.toLocaleLowerCase('tr')).toBe('istanbul');
  expect(profile.locationProfile.address).toContain('Test Apartment 7');
  expect(profile.privacySettings.locationSharingEnabled).toBe(false);
  expect(profile.expertise[0].profession).toBe('Engineer');
  expect(profile.expertise[0].expertiseAreas).toContain('First Aid');
});

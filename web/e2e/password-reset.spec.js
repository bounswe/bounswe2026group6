const { test, expect } = require('@playwright/test');
const { createPasswordResetTokenForEmail, createVerifiedUser } = require('./helpers/api');
const { resetDatabase } = require('./helpers/db');
const { loginThroughUi, openEmailAuthForm } = require('./helpers/ui');

test.beforeEach(async () => {
  await resetDatabase();
});

test('verified user can request a password reset and log in with the new password', async ({ page }) => {
  const email = `reset-${Date.now()}@example.com`;
  const password = 'Passw0rd!';
  const newPassword = 'N3wPassw0rd!';

  await createVerifiedUser({ email, password });

  await page.goto('/login');
  await openEmailAuthForm(page, '#login-email');
  await page.locator('#login-email').fill(email);
  await page.getByRole('button', { name: 'Forgot password?' }).click();

  await expect(page).toHaveURL(/\/forgot-password\?email=/);
  await page.getByRole('button', { name: 'Send Reset Link' }).click();

  await expect(page.getByRole('heading', { name: 'Reset email sent' })).toBeVisible();

  const resetToken = await createPasswordResetTokenForEmail(email);

  await page.goto(`/reset-password?token=${encodeURIComponent(resetToken)}`);
  await page.locator('#reset-password-new').fill(newPassword);
  await page.locator('#reset-password-confirm').fill(newPassword);
  await page.getByRole('button', { name: 'Reset Password' }).click();

  await expect(page.getByText('Password updated')).toBeVisible();
  await page.getByRole('link', { name: 'Back to Log In' }).click();

  await loginThroughUi(page, { email, password: newPassword });
  await expect(page).toHaveURL(/\/complete-profile$/);
});

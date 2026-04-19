const ACCESS_TOKEN_KEY = 'neph_access_token';

async function openEmailAuthForm(page, inputSelector) {
  const emailInput = page.locator(inputSelector);

  if (await emailInput.isVisible().catch(() => false)) {
    return;
  }

  const button = page.getByRole('button', { name: 'Continue with Email' });
  await button.waitFor({ state: 'visible' });
  await button.click();
  await emailInput.waitFor({ state: 'visible' });
}

async function loginThroughUi(page, { email, password }) {
  await openEmailAuthForm(page, '#login-email');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
}

async function signupThroughUi(page, { email, password }) {
  await openEmailAuthForm(page, '#signup-email');
  await page.locator('#signup-email').fill(email);
  await page.locator('#signup-password').fill(password);
  await page.locator('#signup-confirm-password').fill(password);
  await page.getByLabel(/I agree to the/i).check();
  await page.getByRole('button', { name: 'Create Account' }).click();
}

async function getStoredAccessToken(page) {
  return page.evaluate((accessTokenKey) => {
    return (
      window.localStorage.getItem(accessTokenKey) ||
      window.sessionStorage.getItem(accessTokenKey)
    );
  }, ACCESS_TOKEN_KEY);
}

module.exports = {
  getStoredAccessToken,
  loginThroughUi,
  openEmailAuthForm,
  signupThroughUi,
};

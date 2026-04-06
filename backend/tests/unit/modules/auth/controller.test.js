// tests/unit/modules/auth/controller.test.js
'use strict';
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));
jest.mock('../../../../src/modules/auth/service');
jest.mock('../../../../src/modules/auth/validators');

const {
  signup,
  login,
  verifyEmail,
  getMe,
  resendVerification,
  forgotPassword,
  resetPasswordHandler,
  logout,
} = require('../../../../src/modules/auth/controller');

const {
  signupUser,
  loginUser,
  verifyUserEmail,
  getCurrentUser,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  logoutUser,
} = require('../../../../src/modules/auth/service');

const {
  validateSignupInput,
  validateLoginInput,
  validateVerificationInput,
  validateResetPasswordInput,
} = require('../../../../src/modules/auth/validators');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── signup ───────────────────────────────────────────────────────────────────

describe('signup', () => {
  test('400 - validation error', async () => {
    validateSignupInput.mockReturnValue({ code: 'VALIDATION_ERROR', message: 'Invalid' });
    const req = { body: {} };
    const res = mockRes();

    await signup(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('201 - success', async () => {
    validateSignupInput.mockReturnValue(null);
    signupUser.mockResolvedValue({ user: { email: 'test@test.com' } });
    const req = { body: { email: 'test@test.com', password: '12345678', acceptedTerms: true } };
    const res = mockRes();

    await signup(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('409 - email already exists', async () => {
    validateSignupInput.mockReturnValue(null);
    const error = new Error('Email already exists');
    error.code = 'EMAIL_ALREADY_EXISTS';
    signupUser.mockRejectedValue(error);
    const req = { body: {} };
    const res = mockRes();

    await signup(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('500 - internal error', async () => {
    validateSignupInput.mockReturnValue(null);
    signupUser.mockRejectedValue(new Error('unexpected'));
    const req = { body: {} };
    const res = mockRes();

    await signup(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe('login', () => {
  test('400 - validation error', async () => {
    validateLoginInput.mockReturnValue({ code: 'VALIDATION_ERROR', message: 'Invalid' });
    const req = { body: {} };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('200 - success', async () => {
    validateLoginInput.mockReturnValue(null);
    loginUser.mockResolvedValue({ accessToken: 'token', user: {} });
    const req = { body: { email: 'test@test.com', password: '12345678' } };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('401 - invalid credentials', async () => {
    validateLoginInput.mockReturnValue(null);
    const error = new Error('Invalid credentials');
    error.code = 'INVALID_CREDENTIALS';
    loginUser.mockRejectedValue(error);
    const req = { body: {} };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('401 - email not verified', async () => {
    validateLoginInput.mockReturnValue(null);
    const error = new Error('Email not verified');
    error.code = 'EMAIL_NOT_VERIFIED';
    loginUser.mockRejectedValue(error);
    const req = { body: {} };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('500 - internal error', async () => {
    validateLoginInput.mockReturnValue(null);
    loginUser.mockRejectedValue(new Error('unexpected'));
    const req = { body: {} };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── verifyEmail ──────────────────────────────────────────────────────────────

describe('verifyEmail', () => {
  test('400 - validation error', async () => {
    validateVerificationInput.mockReturnValue({ code: 'VALIDATION_ERROR', message: 'Invalid' });
    const req = { query: {} };
    const res = mockRes();

    await verifyEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('200 - success', async () => {
    validateVerificationInput.mockReturnValue(null);
    verifyUserEmail.mockResolvedValue({ user: {} });
    const req = { query: { token: 'validtoken' } };
    const res = mockRes();

    await verifyEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('400 - invalid token', async () => {
    validateVerificationInput.mockReturnValue(null);
    const error = new Error('Invalid token');
    error.code = 'INVALID_VERIFICATION_TOKEN';
    verifyUserEmail.mockRejectedValue(error);
    const req = { query: { token: 'badtoken' } };
    const res = mockRes();

    await verifyEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('500 - internal error', async () => {
    validateVerificationInput.mockReturnValue(null);
    verifyUserEmail.mockRejectedValue(new Error('unexpected'));
    const req = { query: { token: 'sometoken' } };
    const res = mockRes();

    await verifyEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getMe ────────────────────────────────────────────────────────────────────

describe('getMe', () => {
  test('200 - success', async () => {
    getCurrentUser.mockResolvedValue({ email: 'test@test.com' });
    const req = { user: { userId: 'uuid-1' } };
    const res = mockRes();

    await getMe(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('404 - user not found', async () => {
    const error = new Error('User not found');
    error.code = 'USER_NOT_FOUND';
    getCurrentUser.mockRejectedValue(error);
    const req = { user: { userId: 'uuid-1' } };
    const res = mockRes();

    await getMe(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('500 - internal error', async () => {
    getCurrentUser.mockRejectedValue(new Error('unexpected'));
    const req = { user: { userId: 'uuid-1' } };
    const res = mockRes();

    await getMe(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── resendVerification ───────────────────────────────────────────────────────

describe('resendVerification', () => {
  test('400 - missing email', async () => {
    const req = { body: {} };
    const res = mockRes();

    await resendVerification(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('200 - success', async () => {
    resendVerificationEmail.mockResolvedValue({ message: 'Sent' });
    const req = { body: { email: 'test@test.com' } };
    const res = mockRes();

    await resendVerification(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('400 - user not found', async () => {
    const error = new Error('User not found');
    error.code = 'USER_NOT_FOUND';
    resendVerificationEmail.mockRejectedValue(error);
    const req = { body: { email: 'test@test.com' } };
    const res = mockRes();

    await resendVerification(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('500 - internal error', async () => {
    resendVerificationEmail.mockRejectedValue(new Error('unexpected'));
    const req = { body: { email: 'test@test.com' } };
    const res = mockRes();

    await resendVerification(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── forgotPassword ───────────────────────────────────────────────────────────

describe('forgotPassword', () => {
  test('400 - missing email', async () => {
    const req = { body: {} };
    const res = mockRes();

    await forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('200 - success', async () => {
    requestPasswordReset.mockResolvedValue({ message: 'Sent' });
    const req = { body: { email: 'test@test.com' } };
    const res = mockRes();

    await forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('404 - user not found', async () => {
    const error = new Error('User not found');
    error.code = 'USER_NOT_FOUND';
    requestPasswordReset.mockRejectedValue(error);
    const req = { body: { email: 'test@test.com' } };
    const res = mockRes();

    await forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('500 - internal error', async () => {
    requestPasswordReset.mockRejectedValue(new Error('unexpected'));
    const req = { body: { email: 'test@test.com' } };
    const res = mockRes();

    await forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── resetPasswordHandler ─────────────────────────────────────────────────────

describe('resetPasswordHandler', () => {
  test('400 - validation error', async () => {
    validateResetPasswordInput.mockReturnValue({ code: 'VALIDATION_ERROR', message: 'Invalid' });
    const req = { body: {} };
    const res = mockRes();

    await resetPasswordHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('200 - success', async () => {
    validateResetPasswordInput.mockReturnValue(null);
    resetPassword.mockResolvedValue({ message: 'Password reset' });
    const req = { body: { token: 'validtoken', newPassword: '12345678' } };
    const res = mockRes();

    await resetPasswordHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('400 - invalid reset token', async () => {
    validateResetPasswordInput.mockReturnValue(null);
    const error = new Error('Invalid token');
    error.code = 'INVALID_RESET_TOKEN';
    resetPassword.mockRejectedValue(error);
    const req = { body: { token: 'badtoken', newPassword: '12345678' } };
    const res = mockRes();

    await resetPasswordHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('404 - user not found', async () => {
    validateResetPasswordInput.mockReturnValue(null);
    const error = new Error('User not found');
    error.code = 'USER_NOT_FOUND';
    resetPassword.mockRejectedValue(error);
    const req = { body: { token: 'validtoken', newPassword: '12345678' } };
    const res = mockRes();

    await resetPasswordHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('500 - internal error', async () => {
    validateResetPasswordInput.mockReturnValue(null);
    resetPassword.mockRejectedValue(new Error('unexpected'));
    const req = { body: { token: 'validtoken', newPassword: '12345678' } };
    const res = mockRes();

    await resetPasswordHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────

describe('logout', () => {
  test('200 - success', async () => {
    logoutUser.mockResolvedValue({ message: 'Logged out' });
    const req = {};
    const res = mockRes();

    await logout(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('500 - internal error', async () => {
    logoutUser.mockRejectedValue(new Error('unexpected'));
    const req = {};
    const res = mockRes();

    await logout(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
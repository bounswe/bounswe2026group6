// tests/unit/modules/auth/service.test.js
'use strict';

jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

jest.mock('../../../../src/modules/auth/repository');
jest.mock('../../../../src/config/mailer');

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
  findUserByEmail,
  createUser,
  markEmailVerified,
  findUserById,
  findAdminByUserId,
  updateUserPassword,
} = require('../../../../src/modules/auth/repository');

const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require('../../../../src/config/mailer');

const jwt = require('jsonwebtoken');

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── signupUser ───────────────────────────────────────────────────────────────

describe('signupUser', () => {
  test('creates user and sends verification email', async () => {
    findUserByEmail.mockResolvedValue(null);
    createUser.mockResolvedValue({
      user_id: 'uuid-1',
      email: 'test@test.com',
      is_email_verified: false,
      accepted_terms: true,
      created_at: new Date(),
    });
    sendVerificationEmail.mockResolvedValue();

    const result = await signupUser({
      email: 'test@test.com',
      password: '12345678',
      acceptedTerms: true,
    });

    expect(createUser).toHaveBeenCalledTimes(1);
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(result.user.email).toBe('test@test.com');
  });

  test('throws EMAIL_ALREADY_EXISTS if user exists', async () => {
    findUserByEmail.mockResolvedValue({ user_id: 'uuid-1', email: 'test@test.com' });

    await expect(signupUser({
      email: 'test@test.com',
      password: '12345678',
      acceptedTerms: true,
    })).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' });
  });

  test('throws if email sending fails', async () => {
    findUserByEmail.mockResolvedValue(null);
    createUser.mockResolvedValue({
      user_id: 'uuid-1',
      email: 'test@test.com',
      is_email_verified: false,
      accepted_terms: true,
      created_at: new Date(),
    });
    sendVerificationEmail.mockRejectedValue(new Error('SMTP error'));

    await expect(signupUser({
      email: 'test@test.com',
      password: '12345678',
      acceptedTerms: true,
    })).rejects.toThrow('SMTP error');
  });
});

// ─── loginUser ────────────────────────────────────────────────────────────────

describe('loginUser', () => {
  test('throws INVALID_CREDENTIALS if user not found', async () => {
    findUserByEmail.mockResolvedValue(null);

    await expect(loginUser({
      email: 'test@test.com',
      password: '12345678',
    })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  test('throws INVALID_CREDENTIALS if password wrong', async () => {
    findUserByEmail.mockResolvedValue({
      user_id: 'uuid-1',
      email: 'test@test.com',
      password_hash: '$2b$10$invalidhash',
      is_email_verified: true,
      is_deleted: false,
    });

    await expect(loginUser({
      email: 'test@test.com',
      password: 'wrongpassword',
    })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  test('throws EMAIL_NOT_VERIFIED if email not verified', async () => {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('12345678', 10);

    findUserByEmail.mockResolvedValue({
      user_id: 'uuid-1',
      email: 'test@test.com',
      password_hash: hash,
      is_email_verified: false,
      is_deleted: false,
    });

    await expect(loginUser({
      email: 'test@test.com',
      password: '12345678',
    })).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
  });

  test('returns accessToken on successful login', async () => {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('12345678', 10);

    findUserByEmail.mockResolvedValue({
      user_id: 'uuid-1',
      email: 'test@test.com',
      password_hash: hash,
      is_email_verified: true,
      is_deleted: false,
    });
    findAdminByUserId.mockResolvedValue(null);

    const result = await loginUser({
      email: 'test@test.com',
      password: '12345678',
    });

    expect(result.accessToken).toBeDefined();
    expect(result.user.email).toBe('test@test.com');
  });
});

// ─── verifyUserEmail ──────────────────────────────────────────────────────────

describe('verifyUserEmail', () => {
  test('throws INVALID_VERIFICATION_TOKEN for invalid token', async () => {
    await expect(verifyUserEmail('invalidtoken')).rejects.toMatchObject({
      code: 'INVALID_VERIFICATION_TOKEN',
    });
  });

  test('throws INVALID_VERIFICATION_TOKEN for wrong token type', async () => {
    const token = jwt.sign(
      { type: 'wrong-type', userId: 'uuid-1' },
      process.env.JWT_SECRET || 'dev-secret-123'
    );

    await expect(verifyUserEmail(token)).rejects.toMatchObject({
      code: 'INVALID_VERIFICATION_TOKEN',
    });
  });

  test('verifies email successfully', async () => {
    const token = jwt.sign(
      { type: 'email-verification', userId: 'uuid-1', email: 'test@test.com' },
      process.env.JWT_SECRET || 'dev-secret-123'
    );

    markEmailVerified.mockResolvedValue({
      user_id: 'uuid-1',
      email: 'test@test.com',
      is_email_verified: true,
    });

    const result = await verifyUserEmail(token);
    expect(result.user.isEmailVerified).toBe(true);
  });
});

// ─── getCurrentUser ───────────────────────────────────────────────────────────

describe('getCurrentUser', () => {
  test('throws USER_NOT_FOUND if user does not exist', async () => {
    findUserById.mockResolvedValue(null);
    findAdminByUserId.mockResolvedValue(null);

    await expect(getCurrentUser('uuid-1')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });

  test('returns user data', async () => {
    findUserById.mockResolvedValue({
      user_id: 'uuid-1',
      email: 'test@test.com',
      is_email_verified: true,
      accepted_terms: true,
      created_at: new Date(),
      is_deleted: false,
    });
    findAdminByUserId.mockResolvedValue(null);

    const result = await getCurrentUser('uuid-1');
    expect(result.email).toBe('test@test.com');
    expect(result.isAdmin).toBe(false);
  });
});

// ─── resendVerificationEmail ──────────────────────────────────────────────────

describe('resendVerificationEmail', () => {
  test('throws USER_NOT_FOUND if user does not exist', async () => {
    findUserByEmail.mockResolvedValue(null);

    await expect(resendVerificationEmail('test@test.com')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });

  test('throws EMAIL_ALREADY_VERIFIED if already verified', async () => {
    findUserByEmail.mockResolvedValue({
      user_id: 'uuid-1',
      email: 'test@test.com',
      is_email_verified: true,
      is_deleted: false,
    });

    await expect(resendVerificationEmail('test@test.com')).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_VERIFIED',
    });
  });

  test('sends verification email successfully', async () => {
    findUserByEmail.mockResolvedValue({
      user_id: 'uuid-1',
      email: 'test@test.com',
      is_email_verified: false,
      is_deleted: false,
    });
    sendVerificationEmail.mockResolvedValue();

    const result = await resendVerificationEmail('test@test.com');
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(result.message).toBeDefined();
  });
});

// ─── requestPasswordReset ─────────────────────────────────────────────────────

describe('requestPasswordReset', () => {
  test('throws USER_NOT_FOUND if user does not exist', async () => {
    findUserByEmail.mockResolvedValue(null);

    await expect(requestPasswordReset('test@test.com')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });

  test('sends reset email successfully', async () => {
    findUserByEmail.mockResolvedValue({
      user_id: 'uuid-1',
      email: 'test@test.com',
      is_deleted: false,
    });
    sendPasswordResetEmail.mockResolvedValue();

    const result = await requestPasswordReset('test@test.com');
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(result.message).toBeDefined();
  });
});

// ─── resetPassword ────────────────────────────────────────────────────────────

describe('resetPassword', () => {
  test('throws INVALID_RESET_TOKEN for invalid token', async () => {
    await expect(resetPassword({
      token: 'invalidtoken',
      newPassword: '12345678',
    })).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
  });

  test('throws INVALID_RESET_TOKEN for wrong token type', async () => {
    const token = jwt.sign(
      { type: 'wrong-type', userId: 'uuid-1' },
      process.env.JWT_SECRET || 'dev-secret-123'
    );

    await expect(resetPassword({
      token,
      newPassword: '12345678',
    })).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
  });

  test('resets password successfully', async () => {
    const token = jwt.sign(
      { type: 'password-reset', userId: 'uuid-1', email: 'test@test.com' },
      process.env.JWT_SECRET || 'dev-secret-123'
    );

    updateUserPassword.mockResolvedValue({
      user_id: 'uuid-1',
      email: 'test@test.com',
    });

    const result = await resetPassword({ token, newPassword: 'newpass123' });
    expect(updateUserPassword).toHaveBeenCalledTimes(1);
    expect(result.message).toBeDefined();
  });
});

// ─── logoutUser ───────────────────────────────────────────────────────────────

describe('logoutUser', () => {
  test('returns success message', async () => {
    const result = await logoutUser();
    expect(result.message).toBeDefined();
  });
});
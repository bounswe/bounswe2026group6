// tests/unit/modules/auth/validators.test.js
'use strict';

const {
  validateSignupInput,
  validateLoginInput,
  validateVerificationInput,
  validateResetPasswordInput,
} = require('../../../../src/modules/auth/validators');

describe('validateSignupInput', () => {
  test('valid input returns null', () => {
    expect(validateSignupInput({
      email: 'test@test.com',
      password: '12345678',
      acceptedTerms: true,
    })).toBeNull();
  });

  test('missing email returns error', () => {
    expect(validateSignupInput({
      password: '12345678',
      acceptedTerms: true,
    })).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('missing password returns error', () => {
    expect(validateSignupInput({
      email: 'test@test.com',
      acceptedTerms: true,
    })).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('invalid email format returns error', () => {
    expect(validateSignupInput({
      email: 'notanemail',
      password: '12345678',
      acceptedTerms: true,
    })).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('password shorter than 8 characters returns error', () => {
    expect(validateSignupInput({
      email: 'test@test.com',
      password: '123',
      acceptedTerms: true,
    })).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('acceptedTerms false returns error', () => {
    expect(validateSignupInput({
      email: 'test@test.com',
      password: '12345678',
      acceptedTerms: false,
    })).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('validateLoginInput', () => {
  test('valid input returns null', () => {
    expect(validateLoginInput({
      email: 'test@test.com',
      password: '12345678',
    })).toBeNull();
  });

  test('missing email returns error', () => {
    expect(validateLoginInput({
      password: '12345678',
    })).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('missing password returns error', () => {
    expect(validateLoginInput({
      email: 'test@test.com',
    })).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('invalid email format returns error', () => {
    expect(validateLoginInput({
      email: 'notanemail',
      password: '12345678',
    })).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('validateVerificationInput', () => {
  test('valid token returns null', () => {
    expect(validateVerificationInput({ token: 'sometoken' })).toBeNull();
  });

  test('missing token returns error', () => {
    expect(validateVerificationInput({})).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('validateResetPasswordInput', () => {
  test('valid input returns null', () => {
    expect(validateResetPasswordInput({
      token: 'sometoken',
      newPassword: '12345678',
    })).toBeNull();
  });

  test('missing token returns error', () => {
    expect(validateResetPasswordInput({
      newPassword: '12345678',
    })).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('missing newPassword returns error', () => {
    expect(validateResetPasswordInput({
      token: 'sometoken',
    })).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('newPassword shorter than 8 characters returns error', () => {
    expect(validateResetPasswordInput({
      token: 'sometoken',
      newPassword: '123',
    })).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
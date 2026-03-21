function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateSignupInput(body = {}) {
  const { email, password, acceptedTerms } = body;

  if (!email || !password) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Email and password are required',
    };
  }

  if (!isValidEmail(email)) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Email format is invalid',
    };
  }

  if (typeof password !== 'string' || password.length < 8) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Password must be at least 8 characters',
    };
  }

if (!acceptedTerms) {
  return {
    code: 'VALIDATION_ERROR',
    message: 'You must accept the terms to sign up',
  };
}

  return null;
}

function validateLoginInput(body = {}) {
  const { email, password } = body;

  if (!email || !password) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Email and password are required',
    };
  }

  if (!isValidEmail(email)) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Email format is invalid',
    };
  }

  return null;
}

function validateVerificationInput(query = {}) {
  if (!query.token) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Verification token is required',
    };
  }

  return null;
}

module.exports = {
  validateSignupInput,
  validateLoginInput,
  validateVerificationInput,
};
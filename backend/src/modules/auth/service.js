const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const {
  findUserByEmail,
  createUser,
  markEmailVerified,
  findUserById,
  findAdminByUserId,
  updateUserPassword,
  softDeleteUserAccount,
  findUserByGoogleId,
  upsertGoogleUser,
} = require('./repository');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../../config/mailer');

const { env } = require('../../config/env');
const JWT_SECRET = env.jwt.secret;
const ACCESS_TOKEN_EXPIRES_IN = '7d';
const EMAIL_VERIFICATION_EXPIRES_IN = '1d';
const RESET_PASSWORD_EXPIRES_IN = '1h';

function buildAccessTokenPayload(user, adminRecord) {
  return {
    userId: user.user_id,
    email: user.email,
    isAdmin: Boolean(adminRecord),
    adminRole: adminRecord ? adminRecord.role : null,
  };
}

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

function signEmailVerificationToken(user) {
  return jwt.sign(
    {
      type: 'email-verification',
      userId: user.user_id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: EMAIL_VERIFICATION_EXPIRES_IN }
  );
}

function signPasswordResetToken(user) {
  return jwt.sign(
    {
      type: 'password-reset',
      userId: user.user_id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: RESET_PASSWORD_EXPIRES_IN }
  );
}

async function signupUser({ email, password, acceptedTerms }) {
  const normalizedEmail = email.toLowerCase().trim();

  const existingUser = await findUserByEmail(normalizedEmail);

  if (existingUser) {
    const error = new Error('Email already exists');
    error.code = 'EMAIL_ALREADY_EXISTS';
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = uuidv4();

  const createdUser = await createUser({
    userId,
    email: normalizedEmail,
    passwordHash,
    acceptedTerms: Boolean(acceptedTerms),
  });

  const verificationToken = signEmailVerificationToken(createdUser);

  try {
    await sendVerificationEmail(createdUser.email, verificationToken);
  } catch (emailError) {
    console.error('Email sending failed:', emailError);
    throw emailError;
  }

  return {
    message: 'User created successfully. Please check your email to verify your account.',
    user: {
      userId: createdUser.user_id,
      email: createdUser.email,
      isEmailVerified: createdUser.is_email_verified,
      acceptedTerms: createdUser.accepted_terms,
      createdAt: createdUser.created_at,
    },
  };
}

async function loginUser({ email, password }) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await findUserByEmail(normalizedEmail);

  if (!user || user.is_deleted) {
    const error = new Error('Invalid email or password');
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    const error = new Error('Invalid email or password');
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  if (user.is_banned) {
    const error = new Error('Your account is banned. Please contact support.');
    error.code = 'USER_BANNED';
    throw error;
  }

  if (!user.is_email_verified) {
    const error = new Error('Email is not verified');
    error.code = 'EMAIL_NOT_VERIFIED';
    throw error;
  }

  const adminRecord = await findAdminByUserId(user.user_id);
  const tokenPayload = buildAccessTokenPayload(user, adminRecord);
  const accessToken = signAccessToken(tokenPayload);

  return {
    message: 'Login successful',
    accessToken,
    user: {
      userId: user.user_id,
      email: user.email,
      isEmailVerified: user.is_email_verified,
      isAdmin: Boolean(adminRecord),
      adminRole: adminRecord ? adminRecord.role : null,
    },
  };
}

async function verifyUserEmail(token) {
  let decoded;

  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (_error) {
    const error = new Error('Invalid or expired verification token');
    error.code = 'INVALID_VERIFICATION_TOKEN';
    throw error;
  }

  if (decoded.type !== 'email-verification' || !decoded.userId) {
    const error = new Error('Invalid verification token');
    error.code = 'INVALID_VERIFICATION_TOKEN';
    throw error;
  }

  const user = await findUserById(decoded.userId);
  if (!user || user.is_deleted) {
    const error = new Error('Invalid verification token');
    error.code = 'INVALID_VERIFICATION_TOKEN';
    throw error;
  }

  if (user.is_banned) {
    const error = new Error('Your account is banned. Please contact support.');
    error.code = 'USER_BANNED';
    throw error;
  }

  const updatedUser = await markEmailVerified(decoded.userId);
  const adminRecord = await findAdminByUserId(updatedUser.user_id);
  const tokenPayload = buildAccessTokenPayload(updatedUser, adminRecord);
  const accessToken = signAccessToken(tokenPayload);

  return {
    message: 'Email verified successfully',
    accessToken,
    user: {
      userId: updatedUser.user_id,
      email: updatedUser.email,
      isEmailVerified: updatedUser.is_email_verified,
      isAdmin: Boolean(adminRecord),
      adminRole: adminRecord ? adminRecord.role : null,
    },
  };
}

async function getCurrentUser(userId) {
  const user = await findUserById(userId);
  const adminRecord = await findAdminByUserId(userId);

  if (!user || user.is_deleted) {
    const error = new Error('User not found');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  return {
    userId: user.user_id,
    email: user.email,
    isEmailVerified: user.is_email_verified,
    acceptedTerms: user.accepted_terms,
    createdAt: user.created_at,
    isAdmin: Boolean(adminRecord),
    adminRole: adminRecord ? adminRecord.role : null,
  };
}

async function resendVerificationEmail(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await findUserByEmail(normalizedEmail);

  if (!user || user.is_deleted) {
    const error = new Error('User not found');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  if (user.is_email_verified) {
    const error = new Error('Email is already verified');
    error.code = 'EMAIL_ALREADY_VERIFIED';
    throw error;
  }

  const verificationToken = signEmailVerificationToken(user);
  await sendVerificationEmail(user.email, verificationToken);

  return {
    message: 'Verification email sent. Please check your inbox.',
  };
}

async function requestPasswordReset(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await findUserByEmail(normalizedEmail);

  if (!user || user.is_deleted) {
    const error = new Error('User not found');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const resetToken = signPasswordResetToken(user);
  await sendPasswordResetEmail(user.email, resetToken);

  return {
    message: 'Password reset email sent. Please check your inbox.',
  };
}

async function resetPassword({ token, newPassword }) {
  let decoded;

  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (_error) {
    const error = new Error('Invalid or expired reset token');
    error.code = 'INVALID_RESET_TOKEN';
    throw error;
  }

  if (decoded.type !== 'password-reset' || !decoded.userId) {
    const error = new Error('Invalid reset token');
    error.code = 'INVALID_RESET_TOKEN';
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const updatedUser = await updateUserPassword(decoded.userId, passwordHash);

  if (!updatedUser) {
    const error = new Error('User not found');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  return {
    message: 'Password reset successfully. You can now log in with your new password.',
  };
}

async function logoutUser() {
  return {
    message: 'Logged out successfully.',
  };
}

async function deleteCurrentUser(userId) {
  const result = await softDeleteUserAccount(userId);

  if (!result) {
    const error = new Error('User not found');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  return {
    message: 'Account deleted successfully.',
    deleted: true,
    cancelledRequestCount: result.cancelledRequestCount,
    cancelledAssignmentRequestCount: result.cancelledAssignmentRequestCount,
    availabilityCancelled: result.availabilityCancelled,
  };
}

async function loginWithGoogle({ idToken, mode = 'login' }) {
  const clientId = env.google.clientId;
  if (!clientId) {
    const error = new Error('Google Sign-In is not configured on this server. Set GOOGLE_CLIENT_ID.');
    error.code = 'GOOGLE_NOT_CONFIGURED';
    throw error;
  }

  const client = new OAuth2Client(clientId);
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    const error = new Error('Invalid Google ID token');
    error.code = 'INVALID_GOOGLE_TOKEN';
    throw error;
  }

  const { sub: googleId, email, email_verified } = payload;

  if (!email || !email_verified) {
    const error = new Error('Google account does not have a verified email');
    error.code = 'GOOGLE_EMAIL_NOT_VERIFIED';
    throw error;
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check if account is banned/deleted via email lookup
  const existingByEmail = await findUserByEmail(normalizedEmail);
  if (existingByEmail) {
    if (existingByEmail.is_deleted) {
      const error = new Error('This account has been deleted');
      error.code = 'ACCOUNT_DELETED';
      throw error;
    }
    if (existingByEmail.is_banned) {
      const error = new Error('Your account is banned. Please contact support.');
      error.code = 'USER_BANNED';
      throw error;
    }
    // Email exists as a regular (email/password) account — not linked to Google yet
    if (existingByEmail.password_hash && !existingByEmail.google_id) {
      const error = new Error(
        'An account with this email already exists. Please sign in with your email and password.'
      );
      error.code = 'EMAIL_ALREADY_EXISTS';
      throw error;
    }
    // Signup mode: account already linked to Google — reject
    if (mode === 'signup' && existingByEmail.google_id) {
      const error = new Error('An account with this Google email already exists. Please sign in instead.');
      error.code = 'GOOGLE_ACCOUNT_EXISTS';
      throw error;
    }
  } else if (mode === 'login') {
    // Login mode: no account exists — reject
    const error = new Error('No account found for this Google email. Please sign up first.');
    error.code = 'GOOGLE_ACCOUNT_NOT_FOUND';
    throw error;
  }

  const userId = existingByEmail?.user_id || uuidv4();
  const user = await upsertGoogleUser({
    userId,
    email: normalizedEmail,
    googleId,
    acceptedTerms: true,
  });

  const adminRecord = await findAdminByUserId(user.user_id);
  const tokenPayload = buildAccessTokenPayload(user, adminRecord);
  const accessToken = signAccessToken(tokenPayload);

  return {
    message: 'Login successful',
    accessToken,
    user: {
      userId: user.user_id,
      email: user.email,
      isEmailVerified: user.is_email_verified,
      isAdmin: Boolean(adminRecord),
      adminRole: adminRecord ? adminRecord.role : null,
    },
  };
}

module.exports = {
  signupUser,
  loginUser,
  verifyUserEmail,
  getCurrentUser,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  logoutUser,
  deleteCurrentUser,
  loginWithGoogle,
};

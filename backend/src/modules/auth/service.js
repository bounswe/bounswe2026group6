const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const {
  findUserByEmail,
  createUser,
  markEmailVerified,
  findUserById,
  findAdminByUserId,
  updateUserPassword,
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

module.exports = {
  signupUser,
  loginUser,
  verifyUserEmail,
  getCurrentUser,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  logoutUser,
};

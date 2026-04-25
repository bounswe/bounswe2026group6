const crypto = require('crypto');
const { API_BASE_URL, JWT_SECRET } = require('./config');
const { waitForUserByEmail } = require('./db');

function parseDuration(value) {
  if (typeof value === 'number') {
    return value;
  }

  const match = String(value).match(/^(\d+)([smhd])$/i);
  if (!match) {
    throw new Error(`Unsupported duration: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };

  return amount * multipliers[unit];
}

function signJwt(payload, { expiresIn = '1d', secret = JWT_SECRET } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const body = {
    ...payload,
    iat: now,
    exp: now + parseDuration(expiresIn),
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedBody = Buffer.from(JSON.stringify(body)).toString('base64url');
  const unsigned = `${encodedHeader}.${encodedBody}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(unsigned)
    .digest('base64url');

  return `${unsigned}.${signature}`;
}

async function apiRequest(path, { method = 'GET', body, token, expectedStatus = 200 } = {}) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected ${expectedStatus} from ${path}, received ${response.status}: ${text}`
    );
  }

  return data;
}

function createEmailVerificationToken({ userId, email }) {
  return signJwt({
    type: 'email-verification',
    userId,
    email,
  });
}

function createPasswordResetToken({ userId, email }) {
  return signJwt(
    {
      type: 'password-reset',
      userId,
      email,
    },
    { expiresIn: '1h' }
  );
}

async function signupUser({ email, password, acceptedTerms = true }) {
  return apiRequest('/auth/signup', {
    method: 'POST',
    expectedStatus: 201,
    body: {
      email,
      password,
      acceptedTerms,
    },
  });
}

async function verifyUserEmail({ email, userId }) {
  const user = userId ? { user_id: userId } : await waitForUserByEmail(email);
  const token = createEmailVerificationToken({ userId: user.user_id, email });

  return apiRequest(`/auth/verify-email?token=${encodeURIComponent(token)}`);
}

async function createVerifiedUser({ email, password = 'Passw0rd!' }) {
  const signupResponse = await signupUser({ email, password });
  const verificationResponse = await verifyUserEmail({
    email,
    userId: signupResponse.user.userId,
  });

  return {
    ...verificationResponse,
    email,
    password,
  };
}

async function createCompletedUser({ email, password = 'Passw0rd!' } = {}) {
  const verifiedUser = await createVerifiedUser({ email, password });
  const token = verifiedUser.accessToken;

  await apiRequest('/profiles/me', {
    method: 'PATCH',
    token,
    body: {
      firstName: 'Existing',
      lastName: 'User',
      phoneNumber: '+905551112233',
    },
  });

  await apiRequest('/profiles/me/physical', {
    method: 'PATCH',
    token,
    body: {
      age: 29,
      gender: 'female',
      height: 172,
      weight: 63,
    },
  });

  await apiRequest('/profiles/me/health', {
    method: 'PATCH',
    token,
    body: {
      medicalConditions: ['Asthma'],
      chronicDiseases: ['Asthma'],
      allergies: ['Pollen'],
      bloodType: 'a_pos',
    },
  });

  await apiRequest('/profiles/me/location', {
    method: 'PATCH',
    token,
    body: {
      country: 'Turkey',
      city: 'Istanbul',
      address: 'Bostancı, Kadıköy, Existing Street 5',
      displayAddress: 'Bostancı, Kadıköy, Existing Street 5',
      placeId: 'seed:profile-location',
      latitude: 40.9566,
      longitude: 29.0852,
      coordinate: {
        latitude: 40.9566,
        longitude: 29.0852,
        source: 'seed_data',
        accuracyMeters: 12,
        capturedAt: new Date().toISOString(),
      },
    },
  });

  await apiRequest('/profiles/me/privacy', {
    method: 'PATCH',
    token,
    body: {
      locationSharingEnabled: false,
    },
  });

  await apiRequest('/profiles/me/profession', {
    method: 'PATCH',
    token,
    body: {
      profession: 'Engineer',
    },
  });

  await apiRequest('/profiles/me/expertise-areas', {
    method: 'PUT',
    token,
    body: {
      expertiseAreas: ['Logistics'],
    },
  });

  return {
    ...verifiedUser,
    token,
  };
}

async function createPasswordResetTokenForEmail(email) {
  const user = await waitForUserByEmail(email);

  return createPasswordResetToken({
    userId: user.user_id,
    email,
  });
}

async function fetchMyProfile(token) {
  return apiRequest('/profiles/me', {
    token,
  });
}

module.exports = {
  createCompletedUser,
  createEmailVerificationToken,
  createPasswordResetTokenForEmail,
  createVerifiedUser,
  fetchMyProfile,
};

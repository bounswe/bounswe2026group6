const fs = require('fs');
const path = require('path');
const { env } = require('../../config/env');

let adminApp = null;

function normalizeDataPayload(data) {
  const source = data && typeof data === 'object' ? data : {};
  const normalized = {};

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null) {
      continue;
    }
    normalized[key] = String(value);
  }

  return normalized;
}

function resolveServiceAccountPath() {
  const configured = env.push.firebaseServiceAccountPath || 'secrets/firebase-service-account.json';
  const absolute = path.isAbsolute(configured)
    ? configured
    : path.resolve(__dirname, '../../../', configured);
  return absolute;
}

function readServiceAccountJson() {
  const filePath = resolveServiceAccountPath();
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) {
    return null;
  }

  return JSON.parse(raw);
}

function getAdminApp() {
  if (adminApp) {
    return adminApp;
  }

  // Lazily require firebase-admin so log/disabled mode can run without the package.
  // eslint-disable-next-line global-require
  const admin = require('firebase-admin');
  const serviceAccount = readServiceAccountJson();
  if (!serviceAccount) {
    return null;
  }

  adminApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  return adminApp;
}

async function sendViaFcm({ device, notification }) {
  const app = getAdminApp();
  if (!app) {
    return {
      success: false,
      status: 'SKIPPED',
      errorMessage: 'Firebase service account file is missing.',
    };
  }

  // eslint-disable-next-line global-require
  const admin = require('firebase-admin');
  const payload = {
    token: device.deviceToken,
    notification: {
      title: notification.title || 'Notification',
      body: notification.body || '',
    },
    data: normalizeDataPayload({
      notificationId: notification.id,
      type: notification.type,
      ...(notification.data || {}),
    }),
    android: {
      priority: 'high',
    },
  };

  try {
    await admin.messaging(app).send(payload);
    return {
      success: true,
      status: 'DELIVERED',
      errorMessage: null,
    };
  } catch (error) {
    return {
      success: false,
      status: 'FAILED',
      errorMessage: error.message || 'FCM send failed',
    };
  }
}

async function sendPushNotification({ device, notification }) {
  if (env.push.deliveryMode === 'disabled') {
    return {
      success: false,
      status: 'SKIPPED',
      errorMessage: 'Push delivery disabled by configuration.',
    };
  }

  if (env.push.deliveryMode === 'fcm') {
    return sendViaFcm({ device, notification });
  }

  console.log('notifications.push.send', {
    mode: env.push.deliveryMode,
    provider: device.provider,
    platform: device.platform,
    token: device.deviceToken.slice(0, 12),
    notificationId: notification.id,
    type: notification.type,
  });

  return {
    success: true,
    status: 'DELIVERED',
    errorMessage: null,
  };
}

module.exports = {
  sendPushNotification,
};

const jwt = require('jsonwebtoken');
const { findAdminByUserId, findUserAuthStateById } = require('./repository');

const { env } = require('../../config/env');
const JWT_SECRET = env.jwt.secret;

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Authorization token is required',
    });
  }

  const token = authHeader.split(' ')[1];
  let decoded;

  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (_error) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }

  try {
    const userState = await findUserAuthStateById(decoded.userId);

    if (!userState || userState.is_deleted) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
    }

    if (userState.is_banned) {
      return res.status(403).json({
        code: 'USER_BANNED',
        message: 'Your account is banned. Please contact support.',
      });
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email || userState.email,
      isAdmin: decoded.isAdmin,
      adminRole: decoded.adminRole,
    };

    return next();
  } catch (_error) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function requireAdmin(req, res, next) {
  if (!req.user || !req.user.userId) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }

  try {
    const adminRecord = await findAdminByUserId(req.user.userId);

    if (!adminRecord) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Admin access required',
      });
    }

    req.user.isAdmin = true;
    req.user.adminRole = adminRecord.role;
    req.user.adminId = adminRecord.admin_id;

    return next();
  } catch (_error) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded || typeof decoded.userId !== 'string' || decoded.userId.trim() === '') {
      return next();
    }

    const userState = await findUserAuthStateById(decoded.userId);
    if (!userState || userState.is_deleted || userState.is_banned) {
      return next();
    }

    const adminRecord = await findAdminByUserId(decoded.userId);

    const optionalUser = {
      userId: decoded.userId,
      email: userState.email || decoded.email,
      isAdmin: Boolean(adminRecord),
      adminRole: adminRecord ? adminRecord.role : null,
    };

    if (adminRecord) {
      optionalUser.adminId = adminRecord.admin_id;
    }

    req.user = optionalUser;
  } catch (_error) {
    // Token is invalid/expired — proceed as guest
  }

  return next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  optionalAuth,
};

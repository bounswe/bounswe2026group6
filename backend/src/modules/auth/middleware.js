const jwt = require('jsonwebtoken');
const { findAdminByUserId } = require('./repository');

const { env } = require('../../config/env');
const JWT_SECRET = env.jwt.secret;

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Authorization token is required',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      isAdmin: decoded.isAdmin,
      adminRole: decoded.adminRole,
    };

    return next();
  } catch (_error) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
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

    return next();
  } catch (_error) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      isAdmin: decoded.isAdmin,
      adminRole: decoded.adminRole,
    };
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

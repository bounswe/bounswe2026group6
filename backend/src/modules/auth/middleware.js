const jwt = require('jsonwebtoken');

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

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }

  return next();
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
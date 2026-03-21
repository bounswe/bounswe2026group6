function readUserId(request) {
  if (request.user && request.user.userId) {
    return request.user.userId;
  }

  const isDevelopment = process.env.NODE_ENV === 'development';

  // Temporary fallback for local development until auth middleware is integrated.
  if (
    isDevelopment
    && typeof request.headers['x-user-id'] === 'string'
    && request.headers['x-user-id'].trim() !== ''
  ) {
    return request.headers['x-user-id'].trim();
  }

  return null;
}

module.exports = {
  readUserId,
};

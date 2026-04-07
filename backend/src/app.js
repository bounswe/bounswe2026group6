const express = require('express');

const { apiRouter } = require('./routes');

function createApp() {
  const app = express();

  app.use(express.json());

  const legacyApiPrefixes = ['/auth', '/profiles', '/help-requests', '/availability'];

  // Backward compatibility: older mobile builds may call module routes without /api.
  app.use((request, _response, next) => {
    if (request.path === '/api' || request.path.startsWith('/api/')) {
      return next();
    }

    const isLegacyApiCall = legacyApiPrefixes.some(
      (prefix) => request.path === prefix || request.path.startsWith(`${prefix}/`),
    );

    if (isLegacyApiCall) {
      request.url = `/api${request.url}`;
    }

    return next();
  });

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.use('/api', apiRouter);

  app.use((request, response) => {
    response.status(404).json({
      message: `Route not found: ${request.method} ${request.originalUrl}`,
    });
  });

  return app;
}

module.exports = {
  createApp,
};

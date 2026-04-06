const express = require('express');

const { apiRouter } = require('./routes');

function createApp() {
  const app = express();

  app.use(express.json());

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

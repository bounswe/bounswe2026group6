'use strict';

const request = require('supertest');

jest.mock('../../src/routes', () => {
  const express = require('express');
  const router = express.Router();

  router.post('/help-requests', (_request, response) => {
    response.status(400).json({
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
    });
  });

  return {
    apiRouter: router,
  };
});

const { createApp } = require('../../src/app');

describe('app routing compatibility', () => {
  test('rewrites legacy POST /help-requests to /api/help-requests', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/help-requests')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
    });
  });

  test('keeps existing /api routes working', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/help-requests')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
    });
  });

  test('returns 404 for unknown non-api routes', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/unknown-path')
      .send({});

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: 'Route not found: POST /unknown-path',
    });
  });
});

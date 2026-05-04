'use strict';

const request = require('supertest');

jest.mock('../../../../src/modules/auth/routes', () => ({
  authRouter: require('express').Router(),
}));

jest.mock('../../../../src/modules/profiles/routes', () => ({
  profilesRouter: require('express').Router(),
}));

jest.mock('../../../../src/modules/help-requests/routes', () => ({
  helpRequestsRouter: require('express').Router(),
}));

jest.mock('../../../../src/modules/availability/routes', () => ({
  availabilityRouter: require('express').Router(),
}));

const { createApp } = require('../../../../src/app');
const gatheringAreasService = require('../../../../src/modules/gathering-areas/service');

const originalFetch = global.fetch;

beforeEach(() => {
  gatheringAreasService.__resetNearbyCache();
  global.fetch = jest.fn();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('gathering-areas integration - provider failures', () => {
  test('GET /api/gathering-areas/nearby returns 503 when provider is unavailable', async () => {
    const app = createApp();

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=1500&limit=10');

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('OVERPASS_UNAVAILABLE');
  });

  test('GET /api/gathering-areas/nearby returns 503 when provider keeps returning 406', async () => {
    const app = createApp();

    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 406,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 406,
        json: async () => ({}),
      });

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=1500&limit=10');

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('OVERPASS_UNAVAILABLE');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('GET /api/gathering-areas/nearby returns 504 when provider times out', async () => {
    const app = createApp();

    const timeoutError = new Error('timeout');
    timeoutError.name = 'AbortError';
    global.fetch
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError);

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=1500&limit=10');

    expect(response.status).toBe(504);
    expect(response.body.code).toBe('OVERPASS_TIMEOUT');
  });

  test('GET /api/gathering-areas/nearby returns 503 on provider network error', async () => {
    const app = createApp();

    global.fetch.mockRejectedValueOnce(new Error('network down'));

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=1500&limit=10');

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('OVERPASS_UNAVAILABLE');
  });

  test('GET /api/gathering-areas/nearby returns 503 on invalid provider payload', async () => {
    const app = createApp();

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => null,
    });

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=1500&limit=10');

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('OVERPASS_UNAVAILABLE');
  });

  test('GET /api/gathering-areas/nearby returns 503 when payload has no elements array', async () => {
    const app = createApp();

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ note: 'bad payload shape' }),
    });

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=1500&limit=10');

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('OVERPASS_UNAVAILABLE');
  });
});

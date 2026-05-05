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
const originalEnv = {
  GATHERING_AREAS_CACHE_TTL_MS: process.env.GATHERING_AREAS_CACHE_TTL_MS,
  GATHERING_AREAS_STALE_CACHE_TTL_MS: process.env.GATHERING_AREAS_STALE_CACHE_TTL_MS,
  GATHERING_AREAS_OVERPASS_URL: process.env.GATHERING_AREAS_OVERPASS_URL,
  GATHERING_AREAS_OVERPASS_FALLBACK_URLS: process.env.GATHERING_AREAS_OVERPASS_FALLBACK_URLS,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

beforeEach(() => {
  restoreEnv();
  gatheringAreasService.__resetNearbyCache();
  global.fetch = jest.fn();
});

afterEach(() => {
  restoreEnv();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('gathering-areas integration - provider failures', () => {
  test('GET /api/gathering-areas/nearby returns stale cache when provider times out', async () => {
    const app = createApp();
    process.env.GATHERING_AREAS_CACHE_TTL_MS = '1';
    process.env.GATHERING_AREAS_STALE_CACHE_TTL_MS = '60000';

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: 'node',
            id: 7001,
            lat: 41.01,
            lon: 29.01,
            tags: {
              name: 'Stale Cached Area',
              emergency: 'assembly_point',
            },
          },
        ],
      }),
    });

    const first = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=1500&limit=10');

    await new Promise((resolve) => setTimeout(resolve, 5));

    const timeoutError = new Error('timeout');
    timeoutError.name = 'AbortError';
    global.fetch.mockRejectedValue(timeoutError);

    const second = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=1500&limit=10');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.source).toBe('stale_cache');
    expect(second.body.meta).toMatchObject({
      requestedLimit: 10,
      returnedCount: 1,
      stale: true,
      providerErrorCode: 'OVERPASS_TIMEOUT',
    });
    expect(second.body.collection.features[0].properties.name).toBe('Stale Cached Area');
  });

  test('GET /api/gathering-areas/nearby returns stale cache when provider is unavailable', async () => {
    const app = createApp();
    process.env.GATHERING_AREAS_CACHE_TTL_MS = '1';
    process.env.GATHERING_AREAS_STALE_CACHE_TTL_MS = '60000';

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: 'node',
            id: 7002,
            lat: 41.01,
            lon: 29.01,
            tags: {
              name: 'Unavailable Cached Area',
              amenity: 'shelter',
            },
          },
        ],
      }),
    });

    const first = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=1500&limit=10');

    await new Promise((resolve) => setTimeout(resolve, 5));

    global.fetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    const second = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=1500&limit=10');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.source).toBe('stale_cache');
    expect(second.body.meta).toMatchObject({
      stale: true,
      providerErrorCode: 'OVERPASS_UNAVAILABLE',
    });
    expect(second.body.collection.features[0].properties.name).toBe('Unavailable Cached Area');
  });

  test('GET /api/gathering-areas/nearby returns fallback data when provider is unavailable and no cache exists', async () => {
    const app = createApp();

    global.fetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=1500&limit=10');

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('fallback');
    expect(response.body.meta).toMatchObject({
      requestedLimit: 10,
      providerErrorCode: 'OVERPASS_UNAVAILABLE',
    });
    expect(response.body.collection.type).toBe('FeatureCollection');
    expect(response.body.collection.features.length).toBeGreaterThan(0);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('GET /api/gathering-areas/nearby returns fallback data when provider times out and no cache exists', async () => {
    const app = createApp();

    const timeoutError = new Error('timeout');
    timeoutError.name = 'AbortError';
    global.fetch
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError);

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=1500&limit=10');

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('fallback');
    expect(response.body.meta.providerErrorCode).toBe('OVERPASS_TIMEOUT');
    expect(response.body.collection.type).toBe('FeatureCollection');
  });

  test('GET /api/gathering-areas/nearby returns empty fallback collection when no curated area is nearby', async () => {
    const app = createApp();

    global.fetch.mockRejectedValue(new Error('network down'));

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=0&lon=0&radius=1500&limit=10');

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('fallback');
    expect(response.body.meta.returnedCount).toBe(0);
    expect(response.body.collection.features).toHaveLength(0);
  });

  test('GET /api/gathering-areas/nearby returns fallback data on invalid provider payload', async () => {
    const app = createApp();

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => null,
    });

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=1500&limit=10');

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('fallback');
    expect(response.body.meta.providerErrorCode).toBe('OVERPASS_INVALID_PAYLOAD');
  });

  test('GET /api/gathering-areas/nearby attempts fallback Overpass endpoint after primary fails', async () => {
    const app = createApp();
    process.env.GATHERING_AREAS_OVERPASS_URL = 'https://overpass-primary.example/api';
    process.env.GATHERING_AREAS_OVERPASS_FALLBACK_URLS = 'https://overpass-fallback.example/api';

    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          elements: [
            {
              type: 'node',
              id: 7101,
              lat: 41.01,
              lon: 29.01,
              tags: {
                name: 'Fallback Endpoint Area',
                emergency: 'assembly_point',
              },
            },
          ],
        }),
      });

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=1500&limit=10');

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('overpass');
    expect(response.body.collection.features[0].properties.name).toBe('Fallback Endpoint Area');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).toBe('https://overpass-primary.example/api');
    expect(global.fetch.mock.calls[1][0]).toBe('https://overpass-fallback.example/api');
  });
});

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

describe('gathering-areas integration', () => {
  test('GET /api/gathering-areas/nearby returns FeatureCollection', async () => {
    const app = createApp();

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: 'node',
            id: 1001,
            lat: 41.01,
            lon: 29.01,
            tags: {
              name: 'Sample Assembly Area',
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
    expect(response.body.radius).toBe(1500);
    expect(response.body.meta).toEqual({
      requestedLimit: 10,
      returnedCount: 1,
    });
    expect(response.body.collection).toBeTruthy();
    expect(response.body.collection.type).toBe('FeatureCollection');
    expect(response.body.collection.features).toHaveLength(1);
    expect(response.body.collection.features[0].geometry.coordinates).toEqual([29.01, 41.01]);
    expect(response.body.collection.features[0].properties.category).toBe('assembly_point');
    expect(response.body.collection.features[0].properties.distanceMeters).toBeGreaterThanOrEqual(0);
  });

  test('GET /api/gathering-areas/nearby retries with lightweight query after provider 504', async () => {
    const app = createApp();

    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 504,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          elements: [
            {
              type: 'node',
              id: 11001,
              lat: 41.0152,
              lon: 28.9798,
              tags: {
                name: 'Fallback Area',
                amenity: 'shelter',
              },
            },
          ],
        }),
      });

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.015137&lon=28.97953&radius=1500&limit=10');

    expect(response.status).toBe(200);
    expect(response.body.collection.type).toBe('FeatureCollection');
    expect(response.body.collection.features).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('GET /api/gathering-areas/nearby retries with lightweight query after provider 503', async () => {
    const app = createApp();

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
              id: 11002,
              lat: 41.0151,
              lon: 28.9796,
              tags: {
                name: 'Fallback Area 503',
                emergency: 'assembly_point',
              },
            },
          ],
        }),
      });

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.015137&lon=28.97953&radius=1500&limit=10');

    expect(response.status).toBe(200);
    expect(response.body.collection.type).toBe('FeatureCollection');
    expect(response.body.collection.features).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('GET /api/gathering-areas/nearby retries with lightweight query after provider 406', async () => {
    const app = createApp();

    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 406,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          elements: [
            {
              type: 'node',
              id: 11003,
              lat: 41.0153,
              lon: 28.9799,
              tags: {
                name: 'Fallback Area 406',
                emergency: 'assembly_point',
              },
            },
          ],
        }),
      });

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.015137&lon=28.97953&radius=1500&limit=10');

    expect(response.status).toBe(200);
    expect(response.body.collection.type).toBe('FeatureCollection');
    expect(response.body.collection.features).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('GET /api/gathering-areas/nearby validates query params', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=120&lon=29.01');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  test('GET /api/gathering-areas/nearby validates radius and limit as positive integers', async () => {
    const app = createApp();

    const invalidRadiusResponse = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=-1&limit=10');

    expect(invalidRadiusResponse.status).toBe(400);
    expect(invalidRadiusResponse.body.code).toBe('VALIDATION_ERROR');
    expect(invalidRadiusResponse.body.message).toContain('radius');

    const invalidLimitResponse = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=1000&limit=1.5');

    expect(invalidLimitResponse.status).toBe(400);
    expect(invalidLimitResponse.body.code).toBe('VALIDATION_ERROR');
    expect(invalidLimitResponse.body.message).toContain('limit');
  });

  test('GET /api/gathering-areas/nearby uses cache for identical request', async () => {
    const app = createApp();

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: 'node',
            id: 2002,
            lat: 39.92,
            lon: 32.85,
            tags: {
              name: 'Cached Area',
              amenity: 'shelter',
            },
          },
        ],
      }),
    });

    const first = await request(app)
      .get('/api/gathering-areas/nearby?lat=39.92&lon=32.85&radius=1000&limit=5');

    const second = await request(app)
      .get('/api/gathering-areas/nearby?lat=39.92&lon=32.85&radius=1000&limit=5');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.collection.features).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('GET /api/gathering-areas/nearby reuses cache for small GPS jitter', async () => {
    const app = createApp();

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: 'node',
            id: 2100,
            lat: 41.0001,
            lon: 29.0001,
            tags: {
              emergency: 'assembly_point',
            },
          },
        ],
      }),
    });

    const first = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.00004&lon=29.00004&radius=1000&limit=5');

    const second = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.000049&lon=29.000049&radius=1000&limit=5');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.collection.features).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('GET /api/gathering-areas/nearby applies defaults when radius and limit are omitted', async () => {
    const app = createApp();

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: 'node',
            id: 3003,
            lat: 40,
            lon: 29,
            tags: {
              emergency: 'assembly_point',
            },
          },
        ],
      }),
    });

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=40&lon=29');

    expect(response.status).toBe(200);
    expect(response.body.radius).toBe(2000);
    expect(response.body.meta.requestedLimit).toBe(20);
    expect(response.body.meta.returnedCount).toBe(1);
  });

  test('GET /api/gathering-areas/nearby clamps radius and limit to max values', async () => {
    const app = createApp();

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: 'node',
            id: 5001,
            lat: 41.01,
            lon: 29.01,
            tags: {
              amenity: 'shelter',
            },
          },
        ],
      }),
    });

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=999999&limit=999');

    expect(response.status).toBe(200);
    expect(response.body.radius).toBe(10000);
    expect(response.body.meta.requestedLimit).toBe(50);
  });

  test('GET /api/gathering-areas/nearby sorts by distance and removes duplicate elements', async () => {
    const app = createApp();

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          null,
          {
            type: 'node',
            id: 4004,
            lat: 41.0200,
            lon: 29.0200,
            tags: { amenity: 'shelter' },
          },
          {
            type: 'node',
            id: 4004,
            lat: 41.0200,
            lon: 29.0200,
            tags: { amenity: 'shelter' },
          },
          {
            type: 'node',
            id: 4005,
            lat: 41.0101,
            lon: 29.0101,
            tags: { emergency: 'assembly_point' },
          },
          {
            type: 'node',
            id: 4006,
            tags: { emergency: 'assembly_point' },
          },
          'unexpected',
        ],
      }),
    });

    const response = await request(app)
      .get('/api/gathering-areas/nearby?lat=41.01&lon=29.01&radius=2000&limit=5');

    expect(response.status).toBe(200);
    expect(response.body.collection.features).toHaveLength(2);
    expect(response.body.meta.returnedCount).toBe(2);

    const [first, second] = response.body.collection.features;
    expect(first.properties.distanceMeters).toBeLessThanOrEqual(second.properties.distanceMeters);
  });
});

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
const locationService = require('../../../../src/modules/location/service');

const originalFetch = global.fetch;

beforeEach(() => {
  locationService.__resetLocationCache();
  global.fetch = jest.fn();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('location integration', () => {
  test('GET /api/location/tree returns tree for TR', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/location/tree?countryCode=TR');

    expect(response.status).toBe(200);
    expect(response.body.countryCode).toBe('TR');
    expect(response.body.tree).toBeTruthy();
    expect(response.body.tree.cities).toBeTruthy();
    expect(response.body.meta).toBeTruthy();
  });

  test('GET /api/location/tree returns broad TR dataset for dropdown', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/location/tree?countryCode=TR');

    expect(response.status).toBe(200);

    const { cities } = response.body.tree;
    const cityKeys = Object.keys(cities || {});

    // Guard against accidental fallback to tiny static data.
    expect(cityKeys.length).toBeGreaterThanOrEqual(81);
    expect(cities.ankara).toBeTruthy();
    expect(cities.istanbul).toBeTruthy();
    expect(cities.ankara.districts).toBeTruthy();
    expect(Object.keys(cities.ankara.districts)).toContain('cankaya');
  });

  test('GET /api/location/tree meta counts match actual tree content', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/location/tree?countryCode=TR');

    expect(response.status).toBe(200);

    const { tree, meta } = response.body;
    expect(meta).toBeTruthy();

    const cityEntries = Object.values(tree.cities || {});
    let districtCount = 0;
    let neighborhoodCount = 0;

    for (const city of cityEntries) {
      const districtEntries = Object.values(city.districts || {});
      districtCount += districtEntries.length;

      for (const district of districtEntries) {
        neighborhoodCount += Array.isArray(district.neighborhoods)
          ? district.neighborhoods.length
          : 0;
      }
    }

    expect(meta.cityCount).toBe(cityEntries.length);
    expect(meta.districtCount).toBe(districtCount);
    expect(meta.neighborhoodCount).toBe(neighborhoodCount);
    expect(meta.neighborhoodCount).toBeGreaterThan(0);
  });

  test('GET /api/location/tree returns 404 for unknown countryCode', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/location/tree?countryCode=DE');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  test('GET /api/location/search validates q', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/location/search?q=a&countryCode=TR');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  test('GET /api/location/search rejects overly long q', async () => {
    const app = createApp();

    const response = await request(app)
      .get(`/api/location/search?q=${'a'.repeat(121)}&countryCode=TR`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.message).toContain('at most 120 characters');
  });

  test('GET /api/location/reverse validates coordinates', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/location/reverse?lat=120&lon=20');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  test('GET /api/location/search returns mapped results', async () => {
    const app = createApp();

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          place_id: 12345,
          display_name: 'Kadikoy, Istanbul, Turkey',
          lat: '40.9909',
          lon: '29.0303',
          address: {
            country_code: 'tr',
            country: 'Turkey',
            city: 'Istanbul',
            county: 'Kadikoy',
            neighbourhood: 'Moda',
            postcode: '34710',
          },
        },
      ]),
    });

    const response = await request(app)
      .get('/api/location/search?q=Kadikoy&countryCode=TR&limit=5');

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].placeId).toBe('12345');
    expect(response.body.items[0].latitude).toBeCloseTo(40.9909, 6);
    expect(response.body.items[0].longitude).toBeCloseTo(29.0303, 6);
    expect(response.body.items[0].administrative.city).toBe('Istanbul');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('GET /api/location/reverse returns mapped item', async () => {
    const app = createApp();

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        place_id: 67890,
        display_name: 'Besiktas, Istanbul, Turkey',
        lat: '41.0430',
        lon: '29.0090',
        address: {
          country_code: 'tr',
          country: 'Turkey',
          city: 'Istanbul',
          county: 'Besiktas',
          suburb: 'Levent',
          road: 'Buyukdere Cd.',
          postcode: '34330',
        },
      }),
    });

    const response = await request(app)
      .get('/api/location/reverse?lat=41.043&lon=29.009');

    expect(response.status).toBe(200);
    expect(response.body.item.placeId).toBe('67890');
    expect(response.body.item.administrative.district).toBe('Besiktas');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('GET /api/location/reverse maps street extraAddress from pedestrian fallback', async () => {
    const app = createApp();

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        place_id: 98765,
        display_name: 'Levent, Besiktas, Istanbul, Turkey',
        lat: '41.0822',
        lon: '29.0154',
        address: {
          country_code: 'tr',
          country: 'Turkey',
          city: 'Istanbul',
          county: 'Besiktas',
          suburb: 'Levent',
          pedestrian: 'Buyukdere Cd.',
          house_number: '45',
          postcode: '34330',
        },
      }),
    });

    const response = await request(app)
      .get('/api/location/reverse?lat=41.0822&lon=29.0154');

    expect(response.status).toBe(200);
    expect(response.body.item.placeId).toBe('98765');
    expect(response.body.item.administrative.extraAddress).toBe('Buyukdere Cd. 45');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('GET /api/location/search uses in-memory cache for identical queries', async () => {
    const app = createApp();

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          place_id: 33333,
          display_name: 'Cankaya, Ankara, Turkey',
          lat: '39.9208',
          lon: '32.8541',
          address: {
            country_code: 'tr',
            country: 'Turkey',
            city: 'Ankara',
            county: 'Cankaya',
          },
        },
      ]),
    });

    const firstResponse = await request(app)
      .get('/api/location/search?q=Cankaya&countryCode=TR&limit=5');

    const secondResponse = await request(app)
      .get('/api/location/search?q=Cankaya&countryCode=TR&limit=5');

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.items[0].placeId).toBe('33333');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('GET /api/location/search returns 503 when provider is unavailable', async () => {
    const app = createApp();

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    const response = await request(app)
      .get('/api/location/search?q=Besiktas&countryCode=TR&limit=5');

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('GEOCODER_UNAVAILABLE');
  });

  test('GET /api/location/reverse returns 504 on provider timeout', async () => {
    const app = createApp();

    const timeoutError = new Error('timeout');
    timeoutError.name = 'AbortError';
    global.fetch.mockRejectedValueOnce(timeoutError);

    const response = await request(app)
      .get('/api/location/reverse?lat=41.043&lon=29.009');

    expect(response.status).toBe(504);
    expect(response.body.code).toBe('GEOCODER_TIMEOUT');
  });
});

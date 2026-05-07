'use strict';

const request = require('supertest');

describe('location integration - tree unavailable', () => {
  test('GET /api/location/tree returns 503 when location tree data is unavailable', async () => {
    let createApp;

    jest.isolateModules(() => {
      jest.doMock('../../../../src/modules/auth/routes', () => ({
        authRouter: require('express').Router(),
      }));

      jest.doMock('../../../../src/modules/profiles/routes', () => ({
        profilesRouter: require('express').Router(),
      }));

      jest.doMock('../../../../src/modules/help-requests/routes', () => ({
        helpRequestsRouter: require('express').Router(),
      }));

      jest.doMock('../../../../src/modules/availability/routes', () => ({
        availabilityRouter: require('express').Router(),
      }));

      jest.doMock('../../../../src/modules/location/service', () => ({
        getLocationTree: async () => {
          const error = new Error('LOCATION_TREE_UNAVAILABLE');
          error.code = 'LOCATION_TREE_UNAVAILABLE';
          throw error;
        },
        getLocationTreeMeta: async () => ({
          cityCount: 0,
          districtCount: 0,
          neighborhoodCount: 0,
        }),
        searchLocations: async () => [],
        reverseGeocode: async () => null,
      }));

      ({ createApp } = require('../../../../src/app'));
    });

    const app = createApp();

    const response = await request(app)
      .get('/api/location/tree?countryCode=TR');

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('LOCATION_TREE_UNAVAILABLE');
  });
});
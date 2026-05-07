'use strict';

const gatheringAreasService = require('../../../../src/modules/gathering-areas/service');

const originalFetch = global.fetch;

beforeEach(() => {
  gatheringAreasService.__resetNearbyCache();
  global.fetch = jest.fn();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('gathering-areas service', () => {
  test('getNearbyGatheringAreas rethrows unexpected internal errors instead of returning fallback', async () => {
    const unexpectedError = new Error('unexpected transform failure');
    const element = {
      type: 'node',
      id: 8101,
      lat: 41.01,
      lon: 29.01,
    };

    Object.defineProperty(element, 'tags', {
      get() {
        throw unexpectedError;
      },
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ elements: [element] }),
    });

    await expect(gatheringAreasService.getNearbyGatheringAreas({
      lat: 41.01,
      lon: 29.01,
      radius: 1500,
      limit: 10,
    })).rejects.toThrow('unexpected transform failure');
  });
});

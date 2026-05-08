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
  function buildNode(id, latOffset, tags) {
    return {
      type: 'node',
      id,
      lat: 41.01 + latOffset,
      lon: 29.01,
      tags,
    };
  }

  test('getNearbyGatheringAreas includes expanded category filters in Overpass query', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ elements: [] }),
    });

    await gatheringAreasService.getNearbyGatheringAreas({
      lat: 41.01,
      lon: 29.01,
      radius: 1500,
      limit: 10,
    });

    const requestInit = global.fetch.mock.calls[0][1];
    const queryText = decodeURIComponent(requestInit.body.toString());

    expect(queryText).toContain('["emergency"="assembly_point"]');
    expect(queryText).toContain('["amenity"="shelter"]');
    expect(queryText).toContain('["amenity"="hospital"]');
    expect(queryText).toContain('["healthcare"="hospital"]');
    expect(queryText).toContain('["amenity"="police"]');
    expect(queryText).toContain('["amenity"="fire_station"]');
    expect(queryText).toContain('["amenity"="pharmacy"]');
  });

  test('getNearbyGatheringAreas returns stable category metadata in fallback response', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    const result = await gatheringAreasService.getNearbyGatheringAreas({
      lat: 41.01,
      lon: 29.01,
      radius: 1500,
      limit: 10,
    });

    expect(result.source).toBe('fallback');
    expect(result.meta.categories).toEqual(expect.arrayContaining([
      { key: 'assembly_point', label: 'Assembly Point' },
      { key: 'shelter', label: 'Shelter' },
      { key: 'hospital', label: 'Hospital' },
      { key: 'police', label: 'Police Station' },
      { key: 'fire_station', label: 'Fire Station' },
      { key: 'pharmacy', label: 'Pharmacy' },
      { key: 'other', label: 'Other' },
    ]));
  });

  test('getNearbyGatheringAreas balances dense pharmacy results with other available categories', async () => {
    const densePharmacies = Array.from({ length: 12 }, (_, index) => (
      buildNode(9000 + index, (index + 1) * 0.00001, { amenity: 'pharmacy' })
    ));

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          ...densePharmacies,
          buildNode(9101, 0.0020, { amenity: 'hospital' }),
          buildNode(9102, 0.0021, { amenity: 'police' }),
          buildNode(9103, 0.0022, { amenity: 'fire_station' }),
          buildNode(9103, 0.0022, { amenity: 'fire_station' }),
        ],
      }),
    });

    const result = await gatheringAreasService.getNearbyGatheringAreas({
      lat: 41.01,
      lon: 29.01,
      radius: 10000,
      limit: 5,
    });

    const features = result.collection.features;
    const categories = features.map((feature) => feature.properties.category);
    const featureKeys = features.map((feature) => `${feature.properties.osmType}:${feature.properties.id}`);

    expect(features).toHaveLength(5);
    expect(categories).toEqual(expect.arrayContaining([
      'pharmacy',
      'hospital',
      'police',
      'fire_station',
    ]));
    expect(new Set(featureKeys).size).toBe(featureKeys.length);
    expect(result.meta.returnedCount).toBe(5);
  });

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

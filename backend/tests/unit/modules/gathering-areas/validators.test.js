'use strict';

const { validateNearbyQuery, validateViewportQuery } = require('../../../../src/modules/gathering-areas/validators');

describe('gathering-areas validators', () => {
  test('validateViewportQuery accepts discoverable bbox', () => {
    const result = validateViewportQuery({
      bbox: '28.9,40.9,29.2,41.1',
      limit: '10',
    });

    expect(result.ok).toBe(true);
    expect(result.value.bbox).toEqual({
      minLon: 28.9,
      minLat: 40.9,
      maxLon: 29.2,
      maxLat: 41.1,
    });
    expect(result.value.viewport.widestVisibleDimensionKm).toBeLessThanOrEqual(50);
  });

  test('validateViewportQuery rejects invalid and too-large bbox', () => {
    expect(validateViewportQuery({ bbox: '28.9,40.9,29.2' }).ok).toBe(false);
    expect(validateViewportQuery({ bbox: '29.2,40.9,28.9,41.1' }).ok).toBe(false);

    const tooLarge = validateViewportQuery({
      bbox: '28.0,40.0,30.0,42.0',
    });

    expect(tooLarge.ok).toBe(false);
    expect(tooLarge.code).toBe('VIEWPORT_TOO_LARGE');
  });

  test('validateNearbyQuery keeps existing nearby behavior', () => {
    const result = validateNearbyQuery({
      lat: '41.01',
      lon: '29.01',
      radius: '999999',
      limit: '999',
    });

    expect(result.ok).toBe(true);
    expect(result.value.radius).toBe(10000);
    expect(result.value.limit).toBe(50);
  });
});

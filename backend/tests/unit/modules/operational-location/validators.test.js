'use strict';

const {
  validateOperationalLocationPatch,
} = require('../../../../src/modules/operational-location/validators');

describe('operational-location validators', () => {
  test('accepts valid operational location payload', () => {
    const result = validateOperationalLocationPatch({
      latitude: 41.0123,
      longitude: 29.0456,
      accuracyMeters: 20,
      source: 'DEVICE_GPS',
      capturedAt: '2026-05-04T07:00:00Z',
    });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      latitude: 41.0123,
      longitude: 29.0456,
      accuracyMeters: 20,
      source: 'DEVICE_GPS',
      capturedAt: '2026-05-04T07:00:00.000Z',
    });
  });

  test('rejects missing latitude or longitude', () => {
    expect(validateOperationalLocationPatch({ latitude: 41.0123 }).ok).toBe(false);
    expect(validateOperationalLocationPatch({ longitude: 29.0456 }).ok).toBe(false);
  });

  test('rejects invalid coordinate ranges', () => {
    expect(validateOperationalLocationPatch({ latitude: 91, longitude: 29.0456 }).ok).toBe(false);
    expect(validateOperationalLocationPatch({ latitude: 41.0123, longitude: -181 }).ok).toBe(false);
  });

  test('rejects null and empty payloads', () => {
    expect(validateOperationalLocationPatch(null).ok).toBe(false);
    expect(validateOperationalLocationPatch({}).ok).toBe(false);
  });

  test('rejects invalid optional fields', () => {
    expect(validateOperationalLocationPatch({
      latitude: 41.0123,
      longitude: 29.0456,
      accuracyMeters: -1,
    }).ok).toBe(false);

    expect(validateOperationalLocationPatch({
      latitude: 41.0123,
      longitude: 29.0456,
      source: 123,
    }).ok).toBe(false);

    expect(validateOperationalLocationPatch({
      latitude: 41.0123,
      longitude: 29.0456,
      capturedAt: 'not-a-date',
    }).ok).toBe(false);
  });
});

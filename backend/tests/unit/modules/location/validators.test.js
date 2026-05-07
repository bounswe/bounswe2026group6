'use strict';

const {
  validateTreeQuery,
  validateSearchQuery,
  validateReverseQuery,
} = require('../../../../src/modules/location/validators');

describe('location validators', () => {
  describe('validateTreeQuery', () => {
    test('accepts valid country code', () => {
      const result = validateTreeQuery({ countryCode: 'TR' });
      expect(result.ok).toBe(true);
      expect(result.value.countryCode).toBe('TR');
    });

    test('defaults to TR when missing', () => {
      const result = validateTreeQuery({});
      expect(result.ok).toBe(true);
      expect(result.value.countryCode).toBe('TR');
    });

    test('rejects invalid country code', () => {
      const result = validateTreeQuery({ countryCode: 'TUR' });
      expect(result.ok).toBe(false);
      expect(result.message).toContain('2-letter ISO code');
    });
  });

  describe('validateSearchQuery', () => {
    test('accepts valid search query', () => {
      const result = validateSearchQuery({ q: 'Kadikoy', countryCode: 'TR', limit: '5' });
      expect(result.ok).toBe(true);
      expect(result.value.limit).toBe(5);
    });

    test('caps limit at 20', () => {
      const result = validateSearchQuery({ q: 'Kadikoy', countryCode: 'TR', limit: '99' });
      expect(result.ok).toBe(true);
      expect(result.value.limit).toBe(20);
    });

    test('rejects too-short query', () => {
      const result = validateSearchQuery({ q: 'a' });
      expect(result.ok).toBe(false);
      expect(result.message).toContain('at least 2 characters');
    });

    test('rejects too-long query', () => {
      const result = validateSearchQuery({ q: 'a'.repeat(121), countryCode: 'TR' });
      expect(result.ok).toBe(false);
      expect(result.message).toContain('at most 120 characters');
    });

    test('rejects invalid limit', () => {
      const result = validateSearchQuery({ q: 'Kadikoy', limit: '0' });
      expect(result.ok).toBe(false);
      expect(result.message).toContain('positive integer');
    });
  });

  describe('validateReverseQuery', () => {
    test('accepts valid coordinates', () => {
      const result = validateReverseQuery({ lat: '41.043', lon: '29.009' });
      expect(result.ok).toBe(true);
      expect(result.value.lat).toBeCloseTo(41.043, 6);
      expect(result.value.lon).toBeCloseTo(29.009, 6);
    });

    test('rejects out-of-range latitude', () => {
      const result = validateReverseQuery({ lat: '100', lon: '29.009' });
      expect(result.ok).toBe(false);
      expect(result.message).toContain('between -90 and 90');
    });

    test('rejects out-of-range longitude', () => {
      const result = validateReverseQuery({ lat: '41.043', lon: '190' });
      expect(result.ok).toBe(false);
      expect(result.message).toContain('between -180 and 180');
    });
  });
});

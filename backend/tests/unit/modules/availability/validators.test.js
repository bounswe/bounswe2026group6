const {
  validate,
  setAvailabilitySchema,
  syncAvailabilitySchema,
  resolveRequestSchema,
} = require('../../../../src/modules/availability/validators');

describe('Availability Validators', () => {
  describe('setAvailabilitySchema', () => {
    it('should validate correct data', () => {
      const data = { isAvailable: true, latitude: 41.0, longitude: 29.0 };
      const errors = validate(data, setAvailabilitySchema);
      expect(errors).toHaveLength(0);
    });

    it('should allow optional latitude/longitude', () => {
      const data = { isAvailable: false };
      const errors = validate(data, setAvailabilitySchema);
      expect(errors).toHaveLength(0);
    });

    it('should fail if isAvailable is missing', () => {
      const data = { latitude: 41.0 };
      const errors = validate(data, setAvailabilitySchema);
      expect(errors).toContain('isAvailable is required');
    });

    it('should fail if types are incorrect', () => {
      const data = { isAvailable: 'true', latitude: '41.0', longitude: '29.0' };
      const errors = validate(data, setAvailabilitySchema);
      expect(errors).toContain('isAvailable must be a boolean');
      expect(errors).toContain('latitude must be a number');
      expect(errors).toContain('longitude must be a number');
    });
  });

  describe('syncAvailabilitySchema', () => {
    it('should validate correct sync data', () => {
      const data = {
        records: [
          { isAvailable: true, timestamp: '2023-01-01T10:00:00Z' },
          { isAvailable: false, timestamp: '2023-01-01T11:00:00Z' },
        ],
      };
      const errors = validate(data, syncAvailabilitySchema);
      expect(errors).toHaveLength(0);
    });

    it('should fail if records is missing', () => {
      const data = {};
      const errors = validate(data, syncAvailabilitySchema);
      expect(errors).toContain('records is required');
    });

    it('should fail if records is not an array', () => {
      const data = { records: 'not an array' };
      const errors = validate(data, syncAvailabilitySchema);
      expect(errors).toContain('records must be an array');
    });
  });

  describe('resolveRequestSchema', () => {
    it('should validate correct resolve data', () => {
      const data = { requestId: 'req_123' };
      const errors = validate(data, resolveRequestSchema);
      expect(errors).toHaveLength(0);
    });

    it('should fail if requestId is missing', () => {
      const data = {};
      const errors = validate(data, resolveRequestSchema);
      expect(errors).toContain('requestId is required');
    });

    it('should fail if requestId is not a string', () => {
      const data = { requestId: 123 };
      const errors = validate(data, resolveRequestSchema);
      expect(errors).toContain('requestId must be a string');
    });
  });
});

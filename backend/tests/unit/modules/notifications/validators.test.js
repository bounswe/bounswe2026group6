'use strict';

const {
  validateCreateNotificationPayload,
} = require('../../../../src/modules/notifications/validators');

describe('notifications validators', () => {
  test('does not duplicate required-string errors for empty title/body', () => {
    const result = validateCreateNotificationPayload({
      type: 'SYSTEM',
      title: '',
      body: '',
      data: {},
    });

    expect(result.errors).toContain('`title` must not be empty.');
    expect(result.errors).toContain('`body` must not be empty.');
    expect(result.errors.filter((item) => item.includes('`title` is required.'))).toHaveLength(0);
    expect(result.errors.filter((item) => item.includes('`body` is required.'))).toHaveLength(0);
  });

  test('returns single type error when type is non-string', () => {
    const result = validateCreateNotificationPayload({
      type: 123,
      title: 't',
      body: 'b',
    });

    expect(result.errors).toContain('`type` must be a string.');
    expect(result.errors.filter((item) => item.includes('`type` is required.'))).toHaveLength(0);
  });
});

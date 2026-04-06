'use strict';

module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/unit.setup.js'],
      clearMocks: true,
      restoreMocks: true,
      resetMocks: true,
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/integration.setup.js'],
      globalSetup: '<rootDir>/tests/setup/global-setup.js',
      globalTeardown: '<rootDir>/tests/setup/global-teardown.js',
      clearMocks: true,
      restoreMocks: true,
      resetMocks: true,
    },
  ],
};

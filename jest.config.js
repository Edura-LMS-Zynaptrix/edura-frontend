// Jest runs through next/jest, so tests are compiled with the same SWC setup
// (and read the same .env / next.config.js) as the app itself.
const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  // Form tests drive real typing with userEvent; the 5s default is too tight
  // under coverage instrumentation or a busy CI runner.
  testTimeout: 20000,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/*.d.ts',
    '!src/app/**/head.tsx',
  ],
  coverageReporters: ['text-summary', 'text', 'lcov'],
};

module.exports = createJestConfig(config);

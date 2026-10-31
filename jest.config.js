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
  // cobertura is read by diff-cover in CI for the "new code" coverage gate;
  // json-summary is read by the coverage badge job.
  coverageReporters: [
    'text-summary',
    'text',
    'lcov',
    'cobertura',
    'json-summary',
  ],
  // Guideline 6.4 / 8.2: minimum 80% coverage (lines and branches). Jest exits
  // non-zero, failing the Unit Tests check, if any figure falls below it.
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
};

module.exports = createJestConfig(config);

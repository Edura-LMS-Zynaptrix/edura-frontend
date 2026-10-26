// Jest runs through next/jest, so tests are compiled with the same SWC setup
// (and read the same .env / next.config.js) as the app itself.
const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
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
}

module.exports = createJestConfig(config)

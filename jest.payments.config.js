/** @type {import('jest').Config} */
const baseConfig = require("./jest.config.js");

module.exports = {
  ...baseConfig,
  coverageReporters: ["text", "lcov", "json-summary"],
  testMatch: [
    "**/app/api/payments/**/__tests__/**/*.test.ts",
    "**/app/api/customer/payment-methods/**/__tests__/**/*.test.ts",
    "**/web/lib/__tests__/catering-pricing.test.ts",
    "**/api/src/__tests__/*.test.ts"
  ],
  collectCoverageFrom: [
    "apps/web/app/api/payments/**/*.{ts,tsx}",
    "apps/web/app/api/customer/payment-methods/**/*.{ts,tsx}",
    "apps/web/lib/catering-pricing.ts",
    "apps/api/src/webhook/**/*.{ts,tsx}",
    "apps/api/src/utils/verifyHmac.ts",
    "!**/*.d.ts",
    "!**/__tests__/**"
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};

/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/apps", "<rootDir>/packages"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/apps/admin/",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/apps/web/app/$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  collectCoverageFrom: [
    "apps/web/app/**/*.{ts,tsx}",
    "!apps/web/app/**/*.d.ts",
    "!apps/web/app/**/__tests__/**",
    "!apps/web/app/**/node_modules/**",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", {
      tsconfig: {
        jsx: "react-jsx",
        esModuleInterop: true,
        resolveJsonModule: true,
        types: ["jest", "@testing-library/jest-dom"],
      },
    }],
  },
};

module.exports = config;

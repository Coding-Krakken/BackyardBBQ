/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/apps/admin"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  moduleNameMapper: {
    // Map @/ to apps/admin/ root (matches admin tsconfig: "@/*": ["./*"])
    "^@/(.*)$": "<rootDir>/apps/admin/$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          esModuleInterop: true,
          resolveJsonModule: true,
          types: ["jest", "node"],
          strict: true,
          // baseUrl is relative to the project root (where jest is invoked)
          baseUrl: ".",
          paths: {
            // Mirror apps/admin/tsconfig.json: "@/*": ["./*"]
            "@/*": ["apps/admin/*"],
          },
          // noUncheckedIndexedAccess is intentionally off for tests to avoid
          // verbose index-guard boilerplate in test assertions
          noUncheckedIndexedAccess: false,
        },
      },
    ],
  },
};

module.exports = config;

import { defineConfig, devices } from "@playwright/test";

const webBaseUrl = process.env.E2E_WEB_BASE_URL ?? "https://backyard-bbq.vercel.app";
const adminBaseUrl = process.env.E2E_ADMIN_BASE_URL ?? "https://backyard-bbq-admin.vercel.app";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "web-chromium",
      testMatch: /.*\.web\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: webBaseUrl,
      },
    },
    {
      name: "admin-chromium",
      testMatch: /.*\.admin\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: adminBaseUrl,
      },
    },
  ],
});

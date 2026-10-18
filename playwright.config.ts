import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: process.env.E2E_URL || "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.CI ? undefined : "msedge",
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        channel: process.env.CI ? undefined : "msedge",
      },
    },
  ],
  reporter: [["list"], ["html", { open: "never" }]],
});

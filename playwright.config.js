import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    {
      name: 'mobile-firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 390, height: 844 }, isMobile: true },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    {
      name: 'mobile-webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 390, height: 844 }, isMobile: true },
    },
  ],
  webServer: {
    command: 'node tests/server.js',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});

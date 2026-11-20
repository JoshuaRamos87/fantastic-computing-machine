const fs = require('fs');
const { defineConfig, devices, chromium } = require('@playwright/test');
const { APP_URL_PATH } = require('./tests/helpers/app-path');

const PORT = Number(process.env.TEST_SERVER_PORT || 4173);
const BASE_URL = `http://127.0.0.1:${PORT}`;

function resolveChromiumExecutable() {
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  }
  try {
    const pwExec = chromium.executablePath();
    if (pwExec && fs.existsSync(pwExec)) {
      return undefined; // Let Playwright use its managed Chromium
    }
  } catch {
    // Fall through to system browser discovery
  }
  const systemCandidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return systemCandidates.find((p) => fs.existsSync(p));
}

const executablePath = resolveChromiumExecutable();

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'node tests/helpers/static-server.js',
    url: `${BASE_URL}${APP_URL_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        launchOptions: executablePath ? { executablePath } : {},
      },
      testIgnore: /mobile\.spec\.js/,
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        launchOptions: executablePath ? { executablePath } : {},
      },
      testMatch: /mobile\.spec\.js/,
    },
  ],
});

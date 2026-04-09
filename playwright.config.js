const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    channel: 'chromium',
  },
  webServer: {
    command: 'python3 -m http.server 8085',
    port: 8085,
    reuseExistingServer: true,
  },
});

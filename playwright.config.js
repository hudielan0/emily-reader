import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:8766",
    channel: "chrome", // use the Chrome already installed on this Mac
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: "npx vite",
    url: "http://127.0.0.1:8766",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});

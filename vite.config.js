import { defineConfig } from "vite";

// Fixed port: the browser keeps saved books per address, so the port must never change.
// 8766: chosen to avoid ports used by other local apps.
export default defineConfig({
  server: { host: "127.0.0.1", port: 8766, strictPort: true },
  preview: { host: "127.0.0.1", port: 8766, strictPort: true },
  test: { include: ["tests/unit/**/*.test.js"] },
});

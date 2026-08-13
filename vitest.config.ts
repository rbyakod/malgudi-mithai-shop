import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    // Unit tests get the DOM-only setup; integration tests get env loading
    // (MONGODB_URI etc.) so Payload can connect to MongoDB.
    setupFiles: ["./tests/setup.ts", "./tests/setup-integration.ts"],
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/integration/**/*.test.{ts,tsx}",
      "lib/**/*.test.{ts,tsx}",
      "app/**/*.test.{ts,tsx}",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      // Payload's convention: `@payload-config` resolves to ./payload.config.ts
      // (see tsconfig.json paths). Vitest does not read tsconfig paths, so wire
      // it up explicitly here. Without this, importing lib/payload-client.ts
      // fails with "Failed to resolve import @payload-config".
      "@payload-config": path.resolve(__dirname, "./payload.config.ts"),
    },
  },
});

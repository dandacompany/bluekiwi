import { defineConfig } from "vitest/config";

export default defineConfig({
  css: { postcss: { plugins: [] } },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 10000,
  },
});

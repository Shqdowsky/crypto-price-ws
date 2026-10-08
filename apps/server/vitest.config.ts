import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/env-setup.ts"],
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reportOnFailure: true,
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      exclude: ["src/test/**", "src/scripts/**", "**/*.test.ts", "src/config/env.ts"],
    },
  },
});

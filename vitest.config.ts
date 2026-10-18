import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    reporters: ["verbose"],
    onConsoleLog(log) {
      // The SDK logs malformed PAYMENT-SIGNATURE headers to stderr before it
      // returns 402. The negative test asserts that behavior; do not duplicate
      // the expected stack trace in the test report.
      if (log.includes("Failed to decode PAYMENT-SIGNATURE header")) {
        return false;
      }
      return undefined;
    },
  },
});

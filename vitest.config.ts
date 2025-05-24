import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "istanbul",
      include: ["src/**/**.ts"],
      reporter: ["html", "lcov", "text"],
      // thresholds: {
      //   lines: 75,
      // },
    },
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    // Allow top-level await (the project uses ESM)
    pool: "forks",
  },
});

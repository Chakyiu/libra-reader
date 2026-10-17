import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@/": root,
      // `server-only` throws outside a React Server environment; tests import server modules directly.
      "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    env: {
      DATABASE_URL: "file:./.tmp/test/libra-test.db",
      LIBRA_STORAGE_DIR: "./.tmp/test/uploads",
    },
    fileParallelism: false,
  },
});

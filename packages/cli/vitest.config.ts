import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@sensecall/govuk-rewrite": resolve(__dirname, "../core/src/index.ts"),
    },
  },
  test: {
    environment: "node",
  },
});

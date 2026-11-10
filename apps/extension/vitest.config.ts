import {defineConfig} from "vitest/config";

// The tests import the extension's code through its tsconfig.json aliases, as the extension does.
export default defineConfig({
  resolve: {tsconfigPaths: true},
  test: {include: ["tests/**/*.test.ts"]}
});

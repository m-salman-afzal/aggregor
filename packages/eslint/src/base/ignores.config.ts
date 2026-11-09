import {defineConfig, globalIgnores} from "eslint/config";

import type {Config} from "eslint/config";

// ESLint does not read .gitignore. git.d.ts is synced from upstream vscode, and drizzle-kit writes the migrations
// (both also in .prettierignore).
export const IGNORE_CONFIGS: Config[] = defineConfig([
  globalIgnores(["**/dist/**", "**/target/**", "apps/extension/assets/migrations/**", "packages/typings/src/git.d.ts"])
]);

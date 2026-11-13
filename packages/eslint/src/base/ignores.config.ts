import {defineConfig, globalIgnores} from "eslint/config";

import type {Config} from "eslint/config";

// ESLint does not read .gitignore. git.d.ts is synced from upstream vscode, and drizzle-kit writes the migrations
// (both also in .prettierignore). shadcn's CLI writes @pkg/ui's components, which keep its names and shape so
// `shadcn add` can update them.
export const IGNORE_CONFIGS: Config[] = defineConfig([
  globalIgnores([
    "**/dist/**",
    "**/target/**",
    "apps/extension/assets/migrations/**",
    "packages/typings/src/git.d.ts",
    "packages/ui/src/components/**"
  ])
]);

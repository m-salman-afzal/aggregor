import {defineConfig, globalIgnores} from "eslint/config";

import type {Config} from "eslint/config";

// ESLint does not read .gitignore; shadcn's CLI writes @pkg/ui's components, which keep its shape so it can update them.
export const IGNORE_CONFIGS: Config[] = defineConfig([
  globalIgnores([
    "**/dist/**",
    "**/target/**",
    "apps/extension/assets/migrations/**",
    "packages/typings/src/git.d.ts",
    "packages/ui/src/components/**"
  ])
]);

import {defineConfig, globalIgnores} from "eslint/config";

import type {Config} from "eslint/config";

// shadcn's CLI writes them in its own style, so only shadcn.config.ts's rules check them.
export const SHADCN_COMPONENT_FILES = "packages/ui/src/components/**/*.{ts,tsx}";

// ESLint does not read .gitignore.
export const IGNORE_CONFIGS: Config[] = defineConfig([
  globalIgnores(["**/dist/**", "**/target/**", "apps/extension/assets/migrations/**", "packages/typings/src/git.d.ts"])
]);

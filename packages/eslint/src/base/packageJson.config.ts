import packageJson from "eslint-package-json";
import pnpm, {configs as pnpmConfigs} from "eslint-plugin-pnpm";
import {defineConfig} from "eslint/config";

import type {Config} from "eslint/config";

// Every package.json, and the pnpm catalog in pnpm-workspace.yaml that their versions come from.
export const PACKAGE_JSON_CONFIGS: Config[] = defineConfig([
  {
    extends: ["package-json/recommended"],
    files: ["**/package.json"],
    plugins: {
      "package-json": packageJson,
      pnpm
    },
    rules: {
      // The repo pins exact versions on purpose (savePrefix: "" in pnpm-workspace.yaml).
      "package-json/dependency-version-range": ["error", {range: "exact"}],
      // Any manifest below cwd counts as "nested"; the rule has no pnpm-workspace awareness.
      "package-json/no-nested-exports": "off",
      // @types/vscode has no runtime package: the extension host provides `vscode`.
      "package-json/no-orphan-types": "off",
      // VS Code extensions pin `engines.vscode` with a caret and are loaded via `main`.
      "package-json/prefer-engines-range": "off",
      "package-json/prefer-exports": "off",
      // Private workspace packages: nothing is published, so no bundler hints or node ranges.
      "package-json/prefer-side-effects-field": "off",
      "package-json/require-engines": "off",
      // Every version lives once, in pnpm-workspace.yaml's catalog; lint:fix moves a plain version there, and one that
      // differs from the catalog fails instead of starting a second catalog. vsce reads @types/vscode's version to check
      // engines.vscode and fails on catalog:, so it stays a version.
      "pnpm/json-enforce-catalog": ["error", {conflicts: "error", ignores: ["@types/vscode"]}],
      "pnpm/json-prefer-workspace-settings": "error",
      "pnpm/json-valid-catalog": "error"
    }
  },
  ...pnpmConfigs.yaml
]);

import e18e from "@e18e/eslint-plugin";
import css from "@eslint/css";
import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
// import packageJson from "eslint-package-json";
import importX from "eslint-plugin-import-x";
import perfectionist from "eslint-plugin-perfectionist";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
// import pluginPromise from "eslint-plugin-promise";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
// import unicorn from "eslint-plugin-unicorn";
import {defineConfig} from "eslint/config";
import globals from "globals";
import tsEslint from "typescript-eslint";

import type {Config} from "eslint/config";

const config: Config[] = defineConfig([
  // {
  //   extends: ["package-json/recommended"],
  //   files: ["**/package.json"],
  //   plugins: {
  //     "package-json": packageJson
  //   }
  // },
  {
    extends: ["json/recommended"],
    files: ["**/*.json"],
    ignores: ["**/package.json", "**/tsconfig*.json", "./.vscode/*.json"],
    language: "json/json",
    plugins: {json},
    rules: {
      "json/sort-keys": "error"
    }
  },
  {
    extends: ["json/recommended"],
    files: ["**/*.jsonc", "**/tsconfig*.json"],
    language: "json/jsonc",
    plugins: {json}
  },
  {
    extends: ["json/recommended"],
    files: ["**/*.json5"],
    language: "json/json5",
    plugins: {json}
  },
  {
    extends: ["markdown/recommended"],
    files: ["**/*.md"],
    language: "markdown/gfm",
    plugins: {markdown}
  },
  {
    extends: ["css/recommended"],
    files: ["**/*.css"],
    language: "css/css",
    plugins: {css}
  },
  e18e.configs.recommended,
  // pluginPromise.configs["flat/recommended"],
  {
    extends: [
      js.configs.all,
      tsEslint.configs.all,
      eslintPluginPrettierRecommended,

      perfectionist.configs["recommended-alphabetical"],

      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite
      // unicorn.configs.all
    ],
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    ignores: ["node_modules", ".prettierignore", "./src/typings/**/*.d.ts"],
    languageOptions: {
      globals: {...globals.browser, ...globals.node},
      parserOptions: {
        projectService: true
      }
    },
    plugins: {"import-x": importX, js},
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {fixStyle: "separate-type-imports", prefer: "type-imports"}
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/naming-convention": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/prefer-readonly-parameter-types": "off",
      "capitalized-comments": "off",
      "import-x/consistent-type-specifier-style": ["error", "prefer-top-level"],
      "max-lines-per-function": [
        "off",
        {
          IIFEs: true,
          max: 50,
          skipBlankLines: true,
          skipComments: true
        }
      ],
      "max-statements": ["off", {max: 20}, {ignoreTopLevelFunctions: true}],
      "new-cap": "off",
      "newline-before-return": ["error"],
      "no-console": "warn",
      "no-constant-condition": "error",
      "no-duplicate-imports": ["error", {allowSeparateTypeImports: true}],
      "no-undefined": "off",
      "no-unused-expressions": "warn",
      "one-var": "off",
      "perfectionist/sort-imports": [
        "error",
        {
          groups: [
            ["value-builtin", "value-external", "value-internal"],
            {newlinesBetween: 1},
            ["value-parent", "value-sibling", "value-index"],
            {newlinesBetween: 1},
            ["type-import", "type-parent", "type-sibling", "type-index"],
            {newlinesBetween: 1},
            "ts-equals-import",
            {newlinesBetween: 1},
            "unknown"
          ],
          order: "asc",
          sortBy: "path"
        }
      ],
      "sort-imports": "off"
    }
  }
]);

export default config;

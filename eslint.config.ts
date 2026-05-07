import css from "@eslint/css";
import js from "@eslint/js";
// Import pluginReact from "eslint-plugin-react";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import importX from "eslint-plugin-import-x";
import perfectionist from "eslint-plugin-perfectionist";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import pluginPromise from "eslint-plugin-promise";
import {defineConfig} from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

import type {Config} from "eslint/config";

const config: Config[] = defineConfig([
  {
    extends: ["json/recommended"],
    files: ["**/*.json"],
    ignores: ["package.json"],
    language: "json/json",
    plugins: {json},
    rules: {
      "json/sort-keys": "error"
    }
  },
  {
    extends: ["json/recommended"],
    files: ["**/*.jsonc"],
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
  // PluginReact.configs.flat,
  // eslintPluginPrettierRecommended,
  {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    extends: [
      js.configs.all,
      tseslint.configs.all,
      eslintPluginPrettierRecommended,

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      pluginPromise.configs["flat/recommended"],
      perfectionist.configs["recommended-alphabetical"]
    ],
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    ignores: ["node_modules", ".prettierignore"],
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
          // customGroups: [],
          // environment: "node",
          // fallbackSort: {type: "unsorted"},
          // IgnoreCase: true,
          // // InternalPattern: ["^~/.+", "^@/.+", "^#.+"],
          // MaxLineLength: undefined,
          // NewlinesBetween: 1,
          // NewlinesInside: 0,
          order: "asc",
          // PartitionByNewLine: true,
          sortBy: "path"
          // SpecialCharacters: "keep",
          // Type: "alphabetical",
          // UseExperimentalDependencyDetection: true
        }
      ],
      "sort-imports": "off"
    }
  }
]);

export default config;

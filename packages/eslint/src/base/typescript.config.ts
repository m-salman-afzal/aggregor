import e18e from "@e18e/eslint-plugin";
import javascript from "@eslint/js";
import {IMPORT_BANS} from "@pkg/eslint/src/layers/importRules.ts";
import {SYNTAX_BANS} from "@pkg/eslint/src/layers/syntaxBans.ts";
import importX from "eslint-plugin-import-x";
import perfectionist from "eslint-plugin-perfectionist";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import unicorn from "eslint-plugin-unicorn";
import {defineConfig} from "eslint/config";
import globals from "globals";
import {resolve} from "node:path";
import tsEslint from "typescript-eslint";

import type {Config} from "eslint/config";

const REPO_ROOT_PATH = resolve(import.meta.dirname, "../../../..");

export const TYPESCRIPT_CONFIGS: Config[] = defineConfig([
  e18e.configs.recommended,
  {
    extends: [
      javascript.configs.all,
      tsEslint.configs.all,
      eslintPluginPrettierRecommended,

      perfectionist.configs["recommended-alphabetical"]
    ],
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,tsx}"],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        // typescript-eslint looks for tsconfig.json no higher than this file's folder; the repo root lets it find each package's.
        tsconfigRootDir: REPO_ROOT_PATH
      }
    },
    plugins: {"import-x": importX, js: javascript, unicorn},
    rules: {
      "@typescript-eslint/consistent-type-assertions": ["error", {assertionStyle: "never"}],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {fixStyle: "separate-type-imports", prefer: "type-imports"}
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/naming-convention": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/no-restricted-imports": ["error", {paths: IMPORT_BANS}],
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
      // Object destructuring is banned (syntaxBans.ts): a value is read as object.key where it is used.
      "@typescript-eslint/prefer-destructuring": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/prefer-optional-chain": "off",
      "@typescript-eslint/prefer-readonly-parameter-types": "off",
      // Effect's asyncFunction rule bans the async keyword, so a function that returns a promise is a plain function.
      "@typescript-eslint/promise-function-async": "off",
      "capitalized-comments": "off",
      "func-names": ["error", "always", {generators: "never"}],
      "id-length": ["error", {min: 3, properties: "never"}],
      "import-x/consistent-type-specifier-style": ["error", "prefer-top-level"],
      // Files grow as long as their use cases need; functions stay small.
      "max-lines": "off",
      "max-lines-per-function": [
        "error",
        {
          IIFEs: true,
          max: 30,
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
      "no-magic-numbers": "off",
      "no-restricted-properties": [
        "error",
        {message: "Use Effect.fn: it adds the span itself.", object: "Effect", property: "gen"},
        {message: "Use Effect.fn: it adds the span itself.", object: "Effect", property: "withSpan"}
      ],
      "no-restricted-syntax": ["error", ...SYNTAX_BANS],
      "no-ternary": "off",
      "no-undefined": "off",
      "no-underscore-dangle": "off",
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
      "prefer-destructuring": "off",
      // An Effect.fn body is a generator, and a pure one has nothing to yield.
      "require-yield": "off",
      "sort-imports": "off",
      "sort-keys": "off",
      // .claude's skill folders follow Claude Code's kebab-case names.
      "unicorn/filename-case": [
        "error",
        {case: "camelCase", ignore: [String.raw`^\.claude$`], multipleFileExtensions: false}
      ],
      "unicorn/name-replacements": [
        "error",
        {checkFilenames: false, replacements: {clicked: {chosen: true}, repo: {project: true, repository: false}}}
      ]
    }
  }
]);

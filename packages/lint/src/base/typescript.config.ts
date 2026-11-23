import {SHADCN_COMPONENT_FILES} from "@pkg/lint/src/base/ignores.config.ts";
import {TYPESCRIPT_PRESET_RULES} from "@pkg/lint/src/base/typescriptPresetRules.ts";
import {IMPORT_BANS} from "@pkg/lint/src/layers/importRules.ts";
import {SYNTAX_BANS} from "@pkg/lint/src/layers/syntaxBans.ts";

import type {OxlintOverride} from "oxlint";

export const TYPESCRIPT_FILES = "**/*.{js,mjs,cjs,ts,mts,cts,tsx}";

// The preset is what ESLint's and typescript-eslint's all, perfectionist and e18e turned on; these settings sit on top.
export const TYPESCRIPT_OVERRIDES: OxlintOverride[] = [
  {
    excludeFiles: [SHADCN_COMPONENT_FILES],
    files: [TYPESCRIPT_FILES],
    rules: {
      ...TYPESCRIPT_PRESET_RULES,
      "aggregor/max-lines-per-function": ["error", {IIFEs: true, max: 30, skipBlankLines: true, skipComments: true}],
      "capitalized-comments": "off",
      // The formatter lays out braces and line breaks.
      curly: "off",
      // It tells an array's concat from Stream.concat by type, which oxlint's JS plugins don't get.
      "e18e/prefer-spread-syntax": "off",
      "eslint-js/newline-before-return": "error",
      "eslint-js/no-restricted-syntax": ["error", ...SYNTAX_BANS],
      "func-names": ["error", "always", {generators: "never"}],
      // Effect's own names for an effect's success, error and requirements types.
      "id-length": ["error", {exceptions: ["A", "E", "R"], min: 3, properties: "never"}],
      "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
      // ESLint's config set it with no mode, which its rule reads as nothing to check; oxlint's defaults to always.
      "init-declarations": "off",
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-statements": "off",
      "new-cap": "off",
      "no-console": "warn",
      "no-constant-condition": "error",
      "no-duplicate-imports": ["error", {allowSeparateTypeImports: true}],
      "no-restricted-properties": [
        "error",
        {message: "Use Effect.fn: it adds the span itself.", object: "Effect", property: "gen"},
        {message: "Use Effect.fn: it adds the span itself.", object: "Effect", property: "withSpan"}
      ],
      "no-ternary": "off",
      "no-undefined": "off",
      "no-underscore-dangle": "off",
      "no-unexpected-multiline": "off",
      "no-unused-expressions": "warn",
      "no-unused-vars": [
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
      "one-var": "off",
      // An Effect.fn body is a generator, and a pure one has nothing to yield.
      "require-yield": "off",
      "sort-keys": "off",
      "typescript-js/naming-convention": "off",
      "typescript-js/no-restricted-imports": ["error", {paths: IMPORT_BANS}],
      "typescript/consistent-type-assertions": ["error", {assertionStyle: "never"}],
      "typescript/consistent-type-imports": ["error", {fixStyle: "separate-type-imports", prefer: "type-imports"}],
      "typescript/explicit-function-return-type": "off",
      "typescript/explicit-module-boundary-types": "off",
      "typescript/no-explicit-any": "off",
      "typescript/no-magic-numbers": "off",
      "typescript/prefer-nullish-coalescing": "off",
      "typescript/prefer-optional-chain": "off",
      "typescript/prefer-readonly-parameter-types": "off",
      // Effect's asyncFunction rule bans the async keyword, so a function that returns a promise is a plain function.
      "typescript/promise-function-async": "off",
      // Application names a DDD layer and App the whole backend (AppLayer); a utils file's class ends in Utils.
      "unicorn-js/name-replacements": [
        "error",
        {
          checkFilenames: false,
          replacements: {
            application: false,
            clicked: {chosen: true},
            repo: {project: true, repository: false},
            utils: false
          }
        }
      ],
      // .claude's skill folders follow Claude Code's kebab-case names.
      "unicorn/filename-case": [
        "error",
        {case: "camelCase", ignore: [String.raw`^\.claude$`], multipleFileExtensions: false}
      ]
    }
  }
];

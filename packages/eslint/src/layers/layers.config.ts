import {
  ERRORS_PACKAGE_IMPORTS,
  IMPORT_BANS,
  IMPORT_RULES,
  OPTION_IMPORT_BANS
} from "@pkg/eslint/src/layers/importRules.ts";
import {ROLE_NAMES} from "@pkg/eslint/src/layers/roleNames.ts";
import {
  AGENT_NAME_BAN,
  CONSTANT_BANS,
  DEPENDENCY_PARAMETER_BAN,
  ENTITY_EXPORT_BAN,
  ENUM_VALUE_OBJECT_BANS,
  ENUM_VALUES_ACCESS_BAN,
  ERROR_FILE_BAN,
  EXPORTED_TYPE_BAN,
  LAYER_MERGE_SPAN_BAN,
  NESTED_SERVICE_YIELD_BAN,
  NON_TYPE_BAN,
  OBJECT_DESTRUCTURING_BAN,
  PLAIN_FUNCTION_BAN,
  PROVIDE_MERGE_BAN,
  SERVICE_CLASS_BAN,
  SERVICE_LAYER_OWN_SPANS_BAN,
  STATUS_LITERAL_BAN,
  SYNTAX_BANS,
  TOP_LEVEL_FUNCTION_BAN
} from "@pkg/eslint/src/layers/syntaxBans.ts";

import type {Config} from "eslint/config";

const prefixWithExtensionSourceFolder = (filePatterns: readonly string[]) =>
  filePatterns.map((filePattern) => `apps/extension/src/${filePattern}`);

const CODE_BANS = [
  AGENT_NAME_BAN,
  ...SYNTAX_BANS,
  EXPORTED_TYPE_BAN,
  PLAIN_FUNCTION_BAN,
  TOP_LEVEL_FUNCTION_BAN,
  DEPENDENCY_PARAMETER_BAN,
  STATUS_LITERAL_BAN,
  ENUM_VALUES_ACCESS_BAN,
  NESTED_SERVICE_YIELD_BAN,
  SERVICE_LAYER_OWN_SPANS_BAN
];

export const LAYER_CONFIGS: Config[] = [
  ...IMPORT_RULES.map(([sourcePath, paths, patterns]): Config => ({
    files: [`apps/extension/src/${sourcePath}${sourcePath.endsWith(".ts") ? "" : "/**/*.ts"}`],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {paths, patterns: [...patterns, ERRORS_PACKAGE_IMPORTS]}]
    }
  })),
  // A later entry replaces an earlier one's list for the files they share.
  {
    files: ["apps/extension/src/**/*.ts"],
    rules: {"no-restricted-syntax": ["error", ...CODE_BANS, SERVICE_CLASS_BAN]}
  },
  {
    files: prefixWithExtensionSourceFolder([
      "**/*.service.ts",
      "**/*.controller.ts",
      "**/*.errorMessage.ts",
      "**/*.domainService.ts",
      "**/*.utils.ts",
      "**/*.transformer.ts",
      "**/*.view.ts",
      "**/*.infraService.ts",
      "**/*.repository.ts",
      "infrastructure/config/*.config.ts",
      "**/*.middleware.ts",
      "**/*.layer.ts"
    ]),
    rules: {"no-restricted-syntax": ["error", ...CODE_BANS]}
  },
  {
    files: prefixWithExtensionSourceFolder(["infrastructure/di/**/*.ts"]),
    rules: {"no-restricted-syntax": ["error", ...CODE_BANS, LAYER_MERGE_SPAN_BAN]}
  },
  {
    files: prefixWithExtensionSourceFolder(["infrastructure/di/app.layer.ts"]),
    rules: {"no-restricted-syntax": ["error", ...CODE_BANS, LAYER_MERGE_SPAN_BAN, PROVIDE_MERGE_BAN]}
  },
  {
    files: prefixWithExtensionSourceFolder(["extension.ts"]),
    rules: {
      "no-restricted-syntax": ["error", ...CODE_BANS, SERVICE_CLASS_BAN, LAYER_MERGE_SPAN_BAN, PROVIDE_MERGE_BAN]
    }
  },
  {
    files: prefixWithExtensionSourceFolder(["**/*.entity.ts"]),
    rules: {"no-restricted-syntax": ["error", ...CODE_BANS, SERVICE_CLASS_BAN, ENTITY_EXPORT_BAN]}
  },
  {
    files: ["apps/extension/src/**/*.interface.ts"],
    rules: {"no-restricted-syntax": ["error", AGENT_NAME_BAN, ...SYNTAX_BANS, PLAIN_FUNCTION_BAN]}
  },
  {
    files: ["apps/extension/src/**/*.dto.ts"],
    rules: {"no-restricted-syntax": ["error", AGENT_NAME_BAN, ...SYNTAX_BANS, SERVICE_CLASS_BAN, PLAIN_FUNCTION_BAN]}
  },
  {
    files: ["packages/constants/src/**/*.ts"],
    rules: {"no-restricted-syntax": ["error", AGENT_NAME_BAN, ...SYNTAX_BANS, ...CONSTANT_BANS]}
  },
  {
    files: ["packages/vscode/src/**/*.ts", "packages/trace/src/**/*.ts", "packages/errors/src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {paths: IMPORT_BANS, patterns: [ERRORS_PACKAGE_IMPORTS]}],
      "no-restricted-syntax": [
        "error",
        AGENT_NAME_BAN,
        ...SYNTAX_BANS,
        EXPORTED_TYPE_BAN,
        PLAIN_FUNCTION_BAN,
        TOP_LEVEL_FUNCTION_BAN
      ]
    }
  },
  {
    files: ["packages/vscode/src/**/*.utils.ts"],
    rules: {
      "@typescript-eslint/naming-convention": ["error", ...ROLE_NAMES["**/*.utils.ts"]],
      "max-classes-per-file": "off",
      "no-restricted-syntax": ["error", ...CODE_BANS]
    }
  },
  {
    files: ["packages/vscode/src/**/*.type.ts", "packages/trace/src/**/*.type.ts", "packages/errors/src/**/*.type.ts"],
    rules: {"no-restricted-syntax": ["error", AGENT_NAME_BAN, ...SYNTAX_BANS, NON_TYPE_BAN]}
  },
  {
    files: ["packages/vscode/src/vscode.api.ts"],
    rules: {"@typescript-eslint/no-restricted-imports": ["error", {paths: OPTION_IMPORT_BANS}]}
  },
  {
    files: ["apps/extension/src/**/*.valueObject.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        AGENT_NAME_BAN,
        ...SYNTAX_BANS,
        SERVICE_CLASS_BAN,
        PLAIN_FUNCTION_BAN,
        ...ENUM_VALUE_OBJECT_BANS
      ]
    }
  },
  {
    files: ["apps/extension/src/**/*.type.ts"],
    rules: {"no-restricted-syntax": ["error", AGENT_NAME_BAN, ...SYNTAX_BANS, NON_TYPE_BAN]}
  },
  {
    files: ["apps/extension/src/**/*.error.ts"],
    rules: {"no-restricted-syntax": ["error", AGENT_NAME_BAN, ERROR_FILE_BAN, OBJECT_DESTRUCTURING_BAN]}
  },
  // Blank lines split the sorting, so a type built from the file's classes can sit below them.
  {
    files: ["apps/extension/src/**/*.ts"],
    rules: {
      "max-classes-per-file": "off",
      "perfectionist/sort-modules": [
        "error",
        {
          customGroups: [{elementNamePattern: "Errors$", groupName: "errors-class", selector: "class"}],
          groups: [
            "declare-enum",
            "export-enum",
            "enum",
            ["declare-interface", "declare-type"],
            ["export-interface", "export-type"],
            ["interface", "type"],
            "errors-class",
            "declare-class",
            "class",
            "export-class",
            "declare-function",
            "export-function",
            "function"
          ],
          partitionByNewLine: true
        }
      ]
    }
  },
  ...Object.entries(ROLE_NAMES).map(([filePattern, namingOptions]): Config => ({
    files: [`apps/extension/src/${filePattern}`],
    rules: {"@typescript-eslint/naming-convention": ["error", ...namingOptions]}
  }))
];

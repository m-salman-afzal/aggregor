import {IMPORT_BANS, IMPORT_RULES, OPTION_IMPORT_BANS} from "@pkg/eslint/src/layers/importRules.ts";
import {ROLE_NAMES} from "@pkg/eslint/src/layers/roleNames.ts";
import {
  AGENT_NAME_BAN,
  CONSTANT_BANS,
  DOMAIN_SERVICE_EXPORT_BAN,
  ENTITY_EXPORT_BAN,
  ENUM_VALUE_OBJECT_BANS,
  ENUM_VALUES_ACCESS_BAN,
  ERROR_FILE_BAN,
  EXPORTED_TYPE_BAN,
  NON_TYPE_BAN,
  OBJECT_DESTRUCTURING_BAN,
  PLAIN_FUNCTION_BAN,
  SERVICE_CLASS_BAN,
  STATUS_LITERAL_BAN,
  SYNTAX_BANS
} from "@pkg/eslint/src/layers/syntaxBans.ts";

import type {Config} from "eslint/config";

export const LAYER_CONFIGS: Config[] = [
  ...IMPORT_RULES.map(([sourcePath, paths, patterns]): Config => ({
    files: [`apps/extension/src/${sourcePath}${sourcePath.endsWith(".ts") ? "" : "/**/*.ts"}`],
    rules: {"@typescript-eslint/no-restricted-imports": ["error", {paths, patterns}]}
  })),
  {
    files: ["apps/extension/src/**/*.ts"],
    ignores: ["**/*.interface.ts", "**/*.type.ts", "**/*.valueObject.ts", "**/*.dto.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        AGENT_NAME_BAN,
        ...SYNTAX_BANS,
        EXPORTED_TYPE_BAN,
        SERVICE_CLASS_BAN,
        PLAIN_FUNCTION_BAN,
        STATUS_LITERAL_BAN,
        ENUM_VALUES_ACCESS_BAN
      ]
    }
  },
  {
    files: ["apps/extension/src/**/*.entity.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        AGENT_NAME_BAN,
        ...SYNTAX_BANS,
        EXPORTED_TYPE_BAN,
        SERVICE_CLASS_BAN,
        PLAIN_FUNCTION_BAN,
        ENTITY_EXPORT_BAN,
        STATUS_LITERAL_BAN,
        ENUM_VALUES_ACCESS_BAN
      ]
    }
  },
  {
    files: ["apps/extension/src/**/*.domainService.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        AGENT_NAME_BAN,
        ...SYNTAX_BANS,
        EXPORTED_TYPE_BAN,
        SERVICE_CLASS_BAN,
        PLAIN_FUNCTION_BAN,
        DOMAIN_SERVICE_EXPORT_BAN,
        STATUS_LITERAL_BAN,
        ENUM_VALUES_ACCESS_BAN
      ]
    }
  },
  {
    files: ["apps/extension/src/**/*.interface.ts"],
    rules: {"no-restricted-syntax": ["error", AGENT_NAME_BAN, ...SYNTAX_BANS, PLAIN_FUNCTION_BAN]}
  },
  {
    files: ["apps/extension/src/**/*.dto.ts"],
    rules: {"no-restricted-syntax": ["error", AGENT_NAME_BAN, ...SYNTAX_BANS, SERVICE_CLASS_BAN, PLAIN_FUNCTION_BAN]}
  },
  // The texts the user reads live in @pkg/constants, so they call the CLIs agents too.
  {
    files: ["packages/constants/src/**/*.ts"],
    rules: {"no-restricted-syntax": ["error", AGENT_NAME_BAN, ...SYNTAX_BANS, ...CONSTANT_BANS]}
  },
  // @pkg/vscode is shared by presentation and infrastructure, under the same code rules.
  {
    files: ["packages/vscode/src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {paths: IMPORT_BANS}],
      "no-restricted-syntax": ["error", AGENT_NAME_BAN, ...SYNTAX_BANS, EXPORTED_TYPE_BAN, PLAIN_FUNCTION_BAN]
    }
  },
  {
    files: ["packages/vscode/src/**/*.type.ts"],
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
          customGroups: [{elementNamePattern: "Error$", groupName: "error-class", selector: "class"}],
          groups: [
            "declare-enum",
            "export-enum",
            "enum",
            ["declare-interface", "declare-type"],
            ["export-interface", "export-type"],
            ["interface", "type"],
            "error-class",
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

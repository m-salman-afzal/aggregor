import {SHADCN_COMPONENT_FILES} from "@pkg/lint/src/base/ignores.config.ts";

import type {OxlintOverride} from "oxlint";

export const AGGREGOR_RULE_OVERRIDES: OxlintOverride[] = [
  {
    files: ["apps/extension/src/**/*.ts"],
    rules: {"aggregor/declaring-file": "error", "aggregor/span-name": "error", "aggregor/stem-folder": "error"}
  },
  {
    files: ["packages/vscode/src/**/*.ts", "packages/errors/src/**/*.ts"],
    rules: {"aggregor/span-name": "error"}
  },
  // The domain can't import @pkg/constants, so its constants stay beside their rules; a model's shared columns are code.
  {
    excludeFiles: ["apps/extension/src/domain/**", "**/*.model.ts"],
    files: ["apps/extension/src/**/*.ts", "packages/vscode/src/**/*.ts", "packages/errors/src/**/*.ts"],
    rules: {"aggregor/constant-placement": "error"}
  },
  {
    excludeFiles: [SHADCN_COMPONENT_FILES],
    files: ["**/*.{ts,mts,cts,tsx}"],
    rules: {"aggregor/one-line-comment": "error", "aggregor/type-placement": "error"}
  },
  // shadcn's components scroll too (menus, comboboxes), so they aren't ignored here.
  {
    files: ["apps/webview/src/**/*.{ts,tsx}", "packages/ui/src/**/*.{ts,tsx}"],
    rules: {"aggregor/minimal-scrollbar": "error"}
  }
];

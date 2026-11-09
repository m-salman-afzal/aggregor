import {declaringFileRule} from "@pkg/eslint/src/rules/declaringFile.rule.ts";
import {spanNameRule} from "@pkg/eslint/src/rules/spanName.rule.ts";
import {stemFolderRule} from "@pkg/eslint/src/rules/stemFolder.rule.ts";
import {typePlacementRule} from "@pkg/eslint/src/rules/typePlacement.rule.ts";

import type {Config} from "eslint/config";

// The repo's own lint rules, as the aggregor plugin: span names, where type files sit, which files share a folder, and
// where types sit in a file.

const AGGREGOR_PLUGIN = {
  rules: {
    "declaring-file": declaringFileRule,
    "span-name": spanNameRule,
    "stem-folder": stemFolderRule,
    "type-placement": typePlacementRule
  }
};

export const AGGREGOR_PLUGIN_CONFIGS: Config[] = [
  {
    files: ["apps/extension/src/**/*.ts"],
    plugins: {aggregor: AGGREGOR_PLUGIN},
    rules: {"aggregor/declaring-file": "error", "aggregor/span-name": "error", "aggregor/stem-folder": "error"}
  },
  {
    files: ["**/*.{ts,mts,cts}"],
    plugins: {aggregor: AGGREGOR_PLUGIN},
    rules: {"aggregor/type-placement": "error"}
  }
];

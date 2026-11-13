import {buildingBlockRule} from "@pkg/eslint/src/rules/buildingBlock.rule.ts";
import {constantPlacementRule} from "@pkg/eslint/src/rules/constantPlacement.rule.ts";
import {declaringFileRule} from "@pkg/eslint/src/rules/declaringFile.rule.ts";
import {fileRoleRule} from "@pkg/eslint/src/rules/fileRole.rule.ts";
import {kindFolderRule} from "@pkg/eslint/src/rules/kindFolder.rule.ts";
import {moduleBoundaryRule} from "@pkg/eslint/src/rules/moduleBoundary.rule.ts";
import {noPassThroughRule} from "@pkg/eslint/src/rules/noPassThrough.rule.ts";
import {singleConsumerRule} from "@pkg/eslint/src/rules/singleConsumer.rule.ts";
import {spanNameRule} from "@pkg/eslint/src/rules/spanName.rule.ts";
import {stemFolderRule} from "@pkg/eslint/src/rules/stemFolder.rule.ts";
import {typePlacementRule} from "@pkg/eslint/src/rules/typePlacement.rule.ts";

import type {Config} from "eslint/config";

// The repo's own lint rules, as the aggregor plugin: span names, where type files sit, which files share a folder, where
// types sit in a file, and where constants live; and for a front end, the folder-structure skill's rules
// (folderStructure/folderStructure.config.ts turns those on).

export const AGGREGOR_PLUGIN = {
  rules: {
    "building-block": buildingBlockRule,
    "constant-placement": constantPlacementRule,
    "declaring-file": declaringFileRule,
    "file-role": fileRoleRule,
    "kind-folder": kindFolderRule,
    "module-boundary": moduleBoundaryRule,
    "no-pass-through": noPassThroughRule,
    "single-consumer": singleConsumerRule,
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
  // The domain can't import @pkg/constants, so its constants stay beside their rules; a model's shared columns are code.
  {
    files: ["apps/extension/src/**/*.ts", "packages/vscode/src/**/*.ts"],
    ignores: ["apps/extension/src/domain/**", "**/*.model.ts"],
    plugins: {aggregor: AGGREGOR_PLUGIN},
    rules: {"aggregor/constant-placement": "error"}
  },
  {
    files: ["**/*.{ts,mts,cts,tsx}"],
    plugins: {aggregor: AGGREGOR_PLUGIN},
    rules: {"aggregor/type-placement": "error"}
  }
];

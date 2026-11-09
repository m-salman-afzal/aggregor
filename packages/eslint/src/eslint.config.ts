import {IGNORE_CONFIGS} from "@pkg/eslint/src/base/ignores.config.ts";
import {JSON_CONFIGS} from "@pkg/eslint/src/base/json.config.ts";
import {MARKDOWN_CONFIGS} from "@pkg/eslint/src/base/markdown.config.ts";
import {PACKAGE_JSON_CONFIGS} from "@pkg/eslint/src/base/packageJson.config.ts";
import {TYPESCRIPT_CONFIGS} from "@pkg/eslint/src/base/typescript.config.ts";
import {LAYER_CONFIGS} from "@pkg/eslint/src/layers/layers.config.ts";
import {AGGREGOR_PLUGIN_CONFIGS} from "@pkg/eslint/src/rules/aggregor.plugin.ts";
import {defineConfig} from "eslint/config";

import type {Config} from "eslint/config";

// The repo's whole ESLint setup, in the order ESLint applies it: what to skip, each file type's base rules, then the
// DDD layering and the repo's own rules for apps/extension.
const eslintConfigs: Config[] = defineConfig([
  ...IGNORE_CONFIGS,
  ...PACKAGE_JSON_CONFIGS,
  ...JSON_CONFIGS,
  ...MARKDOWN_CONFIGS,
  ...TYPESCRIPT_CONFIGS,
  ...LAYER_CONFIGS,
  ...AGGREGOR_PLUGIN_CONFIGS
]);

export default eslintConfigs;

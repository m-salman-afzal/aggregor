import {fileURLToPath} from "node:url";

import {defineConfig} from "oxlint";

import {IGNORED_FILES} from "@pkg/lint/src/base/ignores.config.ts";
import {SHADCN_OVERRIDES} from "@pkg/lint/src/base/shadcn.config.ts";
import {TYPESCRIPT_OVERRIDES} from "@pkg/lint/src/base/typescript.config.ts";
import {FOLDER_STRUCTURE_OVERRIDES} from "@pkg/lint/src/folderStructure/folderStructure.config.ts";
import {LAYER_OVERRIDES} from "@pkg/lint/src/layers/layers.config.ts";
import {AGGREGOR_RULE_OVERRIDES} from "@pkg/lint/src/rules/aggregorRules.config.ts";

const resolvePluginPath = (pluginSpecifier: string) => fileURLToPath(import.meta.resolve(pluginSpecifier));

export default defineConfig({
  // Only the rules the overrides name run.
  categories: {correctness: "off"},
  ignorePatterns: IGNORED_FILES,
  jsPlugins: [
    {name: "aggregor", specifier: resolvePluginPath("@pkg/lint/src/rules/aggregor.plugin.ts")},
    {name: "e18e", specifier: resolvePluginPath("@e18e/eslint-plugin")},
    {name: "eslint-js", specifier: resolvePluginPath("oxlint-plugin-eslint")},
    {name: "perfectionist", specifier: resolvePluginPath("eslint-plugin-perfectionist")},
    {name: "typescript-js", specifier: resolvePluginPath("@pkg/lint/src/base/typescriptEslintRules.plugin.ts")},
    {name: "unicorn-js", specifier: resolvePluginPath("eslint-plugin-unicorn")}
  ],
  options: {maxWarnings: 0, reportUnusedDisableDirectives: "error", typeAware: true},
  overrides: [
    ...TYPESCRIPT_OVERRIDES,
    ...SHADCN_OVERRIDES,
    ...LAYER_OVERRIDES,
    ...AGGREGOR_RULE_OVERRIDES,
    ...FOLDER_STRUCTURE_OVERRIDES
  ],
  plugins: ["eslint", "typescript", "unicorn", "import", "react"]
});

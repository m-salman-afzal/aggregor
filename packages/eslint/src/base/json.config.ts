import json from "@eslint/json";
import {defineConfig} from "eslint/config";

import type {Config} from "eslint/config";

// JSON files with sorted keys; JSONC (tsconfigs) and JSON5 as their own languages.
export const JSON_CONFIGS: Config[] = defineConfig([
  {
    extends: ["json/recommended"],
    files: ["**/*.json"],
    ignores: ["**/package.json", "**/tsconfig*.json", "./.vscode/*.json"],
    language: "json/json",
    plugins: {json},
    rules: {
      "json/sort-keys": "error"
    }
  },
  {
    extends: ["json/recommended"],
    files: ["**/*.jsonc", "**/tsconfig*.json"],
    language: "json/jsonc",
    plugins: {json}
  },
  {
    extends: ["json/recommended"],
    files: ["**/*.json5"],
    language: "json/json5",
    plugins: {json}
  }
]);

import markdown from "@eslint/markdown";
import {defineConfig} from "eslint/config";

import type {Config} from "eslint/config";

export const MARKDOWN_CONFIGS: Config[] = defineConfig([
  {
    extends: ["markdown/recommended"],
    files: ["**/*.md"],
    language: "markdown/gfm",
    plugins: {markdown}
  }
]);

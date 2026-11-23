import {defineConfig} from "oxfmt";

export default defineConfig({
  arrowParens: "always",
  bracketSameLine: true,
  bracketSpacing: false,
  embeddedLanguageFormatting: "auto",
  endOfLine: "lf",
  htmlWhitespaceSensitivity: "css",
  ignorePatterns: ["assets/", "pnpm-lock.yaml", ".gitignore", ".husky/", "packages/typings/src/git.d.ts"],
  jsxSingleQuote: false,
  printWidth: 120,
  proseWrap: "always",
  quoteProps: "as-needed",
  semi: true,
  singleAttributePerLine: false,
  singleQuote: false,
  sortImports: {
    groups: [
      "value-builtin",
      "value-external",
      "value-internal",
      "value-parent",
      "value-sibling",
      "value-index",
      "type-builtin",
      "type-external",
      "type-internal",
      "type-parent",
      "type-sibling",
      "type-index",
      "unknown"
    ],
    internalPattern: ["@/", "@pkg/"],
    newlinesBetween: true
  },
  sortTailwindcss: {functions: ["cn", "cva"], stylesheet: "./packages/ui/src/theme.css"},
  tabWidth: 2,
  trailingComma: "none",
  useTabs: false
});

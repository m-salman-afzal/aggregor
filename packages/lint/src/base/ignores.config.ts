// shadcn's CLI writes them in its own style, so only shadcn.config.ts's rules check them.
export const SHADCN_COMPONENT_FILES = "packages/ui/src/components/**/*.{ts,tsx}";

export const IGNORED_FILES = [
  "**/dist/**",
  "**/target/**",
  "apps/extension/assets/migrations/**",
  "packages/typings/src/git.d.ts"
];

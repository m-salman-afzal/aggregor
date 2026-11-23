// oxlint-plugin-eslint ships no types of its own.
declare module "oxlint-plugin-eslint" {
  import type {Plugin} from "@oxlint/plugins";

  const eslintJsPlugin: Plugin;
  export default eslintJsPlugin;
}

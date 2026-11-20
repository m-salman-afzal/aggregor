import {defineConfig} from "bumpp";

export default defineConfig({
  commit: "chore(release): bump version to {version}",
  files: ["apps/extension/package.json", "package.json"],
  pr: {base: "dev", body: "Bumps the extension from {oldVersion} to {version}.", branch: "chore/bump-v{version}"},
  printCommits: false,
  tag: false
});

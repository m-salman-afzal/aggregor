import {defineConfig} from "bumpp";

// Opens a chore/bump-v<version> PR into dev; merging it opens the release PR.
export default defineConfig({
  commit: "chore(release): bump version to {version}",
  // The first file is the version source.
  files: ["apps/extension/package.json", "package.json"],
  pr: {base: "dev", body: "Bumps the extension from {oldVersion} to {version}.", branch: "chore/bump-v{version}"},
  printCommits: false,
  tag: false
});

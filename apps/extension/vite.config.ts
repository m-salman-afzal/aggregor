/* eslint-disable no-console */
import {builtinModules} from "node:module";
import {defineConfig} from "vite";

import type {Plugin} from "vite";

const problemMatcherPlugin: Plugin = {
  buildEnd(error) {
    if (error) {
      console.error(`✘ [ERROR] ${error.message}`);
      console.log("[watch] build finished");
    }
  },
  buildStart() {
    console.log("[watch] build started");
  },
  name: "problem-matcher",
  writeBundle() {
    console.log("[watch] build finished");
  }
};

const externalNode = /^node:/u;

export default defineConfig((configEnvironment) => {
  const production = configEnvironment.mode === "production";

  return {
    build: {
      emptyOutDir: true,
      lib: {entry: "src/extension.ts", fileName: () => "extension.js", formats: ["es"]},
      minify: production,
      outDir: "dist",
      // vscode is the host and node builtins stay external; everything else, effect included, is bundled.
      rolldownOptions: {external: ["vscode", externalNode, ...builtinModules]},
      sourcemap: !production,
      target: "node24"
    },
    plugins: [problemMatcherPlugin]
  };
});

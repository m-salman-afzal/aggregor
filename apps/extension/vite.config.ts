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

export default defineConfig(({mode}) => {
  const production = mode === "production";

  return {
    build: {
      emptyOutDir: true,
      lib: {entry: "src/extension.ts", fileName: () => "extension.js", formats: ["es"]},
      minify: production,
      outDir: "dist",
      // vscode is the host; node builtins (bare `fs` + every `node:` form) stay external.
      // everything else (incl. @agentclientprotocol/sdk) is bundled
      rolldownOptions: {external: ["vscode", externalNode, ...builtinModules]},
      sourcemap: production,
      target: "node24"
    },
    plugins: [problemMatcherPlugin]
  };
});

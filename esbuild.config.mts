import esb from "esbuild";

import type {Plugin} from "esbuild";
const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const esbuildProblemMatcherPlugin: Plugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      for (const {location, text} of result.errors) {
        console.error(`✘ [ERROR] ${text}`);
        if (location) {
          console.error(`    ${location.file}:${location.line}:${location.column}`);
        }
      }
      console.log("[watch] build finished");
    });
  }
};

const main = async () => {
  const ctx = await esb.context({
    bundle: true,
    entryPoints: ["src/extension.ts"],
    external: ["vscode"],
    format: "esm",
    logLevel: "silent",
    minify: production,
    outfile: "dist/extension.js",
    platform: "node",
    plugins: [
      /* Add to the end of plugins array */
      esbuildProblemMatcherPlugin
    ],
    sourcemap: !production,
    sourcesContent: false
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
};

try {
  await main();
} catch {
  // Oxlint-disable-next-line unicorn/no-process-exit, no-magic-numbers
  process.exit(1);
}

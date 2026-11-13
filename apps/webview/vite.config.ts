import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, {reactCompilerPreset} from "@vitejs/plugin-react";
import {defineConfig} from "vite";

// The build lands in the extension's dist, which the VSIX ships and the view loads with fixed names. F5's webview loads
// the dev server instead, from a vscode-webview: page, so the server allows that origin and serves absolute URLs.
export default defineConfig({
  build: {
    emptyOutDir: true,
    modulePreload: false,
    outDir: "../extension/dist/webview",
    rolldownOptions: {
      input: "src/main.tsx",
      output: {assetFileNames: "webview.[ext]", entryFileNames: "webview.js"}
    }
  },
  plugins: [react(), babel({presets: [reactCompilerPreset()]}), tailwindcss()],
  resolve: {tsconfigPaths: true},
  server: {cors: {origin: /^vscode-webview:\/\//u}, origin: "http://localhost:5179", port: 5179, strictPort: true}
});

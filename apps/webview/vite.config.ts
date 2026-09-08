import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, {reactCompilerPreset} from "@vitejs/plugin-react";
import {defineConfig} from "vite";

// https://vite.dev/config/
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        assetFileNames: "assets/index.[ext]",
        entryFileNames: "assets/index.js"
      }
    }
  },
  plugins: [react(), babel({presets: [reactCompilerPreset()]}), tailwindcss()]
});

import {defineConfig} from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  out: "./assets/migrations",
  schema: "./src/infrastructure/database/models/*.model.ts"
});

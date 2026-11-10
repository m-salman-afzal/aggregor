import {MIGRATIONS_FOLDER} from "@pkg/constants/src/database.constant.ts";
import {defineConfig} from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  out: MIGRATIONS_FOLDER,
  schema: "./src/infrastructure/database/models/*.model.ts"
});

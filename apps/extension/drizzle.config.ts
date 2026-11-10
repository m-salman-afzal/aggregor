import {MIGRATIONS} from "@pkg/constants/src/database.constant.ts";
import {defineConfig} from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  out: MIGRATIONS.FOLDER,
  schema: "./src/infrastructure/database/models/*.model.ts"
});

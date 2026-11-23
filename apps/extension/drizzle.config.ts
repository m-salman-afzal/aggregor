import {defineConfig} from "drizzle-kit";

import {MIGRATIONS} from "@pkg/constants/src/database.constant.ts";

export default defineConfig({
  dialect: "sqlite",
  out: MIGRATIONS.FOLDER,
  schema: "./src/infrastructure/database/models/*.model.ts"
});

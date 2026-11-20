import {NodeServices} from "@effect/platform-node";
import {SqliteClient} from "@effect/sql-sqlite-node";
import {DatabaseUtils} from "@infraUtils/database.utils.ts";
import {AGGREGOR_FOLDER} from "@pkg/constants/src/app.constant.ts";
import {MIGRATIONS} from "@pkg/constants/src/database.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {Context, Effect, Layer} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

export class Database extends Context.Service<Database>()("aggregor-app/infrastructure/di/database.layer/Database", {
  make: Effect.fn("make")(function* () {
    const fileSystem = yield* FileSystem;
    const path = yield* Path;
    const vsCodeApi = yield* VsCodeApi;
    const databaseUtils = yield* DatabaseUtils;

    const openDatabaseFile = Effect.fn("openDatabaseFile")(function* () {
      const databaseFilePath = yield* databaseUtils.getDatabaseFilePath;
      yield* fileSystem.makeDirectory(path.dirname(databaseFilePath), {mode: AGGREGOR_FOLDER.MODE, recursive: true});

      return SqliteClient.layer({filename: databaseFilePath});
    });

    const migrateDatabase = Effect.fn("migrateDatabase")(function* () {
      yield* databaseUtils.applyPendingMigrations(
        vsCodeApi.Uri.joinPath(vsCodeApi.extensionUri, MIGRATIONS.FOLDER).fsPath
      );
    });

    return {migrateDatabase: migrateDatabase(), openDatabaseFile: openDatabaseFile()};
  })
}) {
  public static readonly layer = Layer.effect(this, ownSpans("Database", this.make())).pipe(
    Layer.provide([DatabaseUtils.layer, NodeServices.layer])
  );
}

export const DatabaseLayer = Layer.effectDiscard(Database.use((database) => database.migrateDatabase)).pipe(
  Layer.provideMerge(Layer.unwrap(Database.use((database) => database.openDatabaseFile))),
  Layer.provide(Database.layer)
);

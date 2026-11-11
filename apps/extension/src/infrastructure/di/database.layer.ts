import {SqliteClient} from "@effect/sql-sqlite-node";
import {applyPendingMigrations, getDatabaseFilePath} from "@infraUtils/database.utils.ts";
import {AGGREGOR_FOLDER} from "@pkg/constants/src/app.constant.ts";
import {MIGRATIONS} from "@pkg/constants/src/database.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {Effect, Layer} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

const openDatabaseFile = Effect.fn("Database.openDatabaseFile")(function* () {
  const fileSystem = yield* FileSystem;
  const path = yield* Path;
  const databaseFilePath = yield* getDatabaseFilePath();
  yield* fileSystem.makeDirectory(path.dirname(databaseFilePath), {mode: AGGREGOR_FOLDER.MODE, recursive: true});

  return SqliteClient.layer({filename: databaseFilePath});
});

const migrateDatabase = Effect.fn("Database.migrateDatabase")(function* () {
  const {extensionUri, Uri} = yield* VsCodeApi;

  yield* applyPendingMigrations(Uri.joinPath(extensionUri, MIGRATIONS.FOLDER).fsPath);
});

export const DatabaseLayer = Layer.effectDiscard(migrateDatabase()).pipe(
  Layer.provideMerge(Layer.unwrap(openDatabaseFile()))
);

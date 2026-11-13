import {NodeServices} from "@effect/platform-node";
import {SqliteClient} from "@effect/sql-sqlite-node";
import {applyPendingMigrations} from "@infraUtils/database.utils.ts";
import {DATABASE_BACKUP, DATABASE_FILE, MIGRATIONS} from "@pkg/constants/src/database.constant.ts";
import {Array, Effect, Order, String} from "effect";
import {FileSystem} from "effect/FileSystem";
import {SqlClient} from "effect/sql/SqlClient";
import {readdirSync} from "node:fs";
import {join} from "node:path";
import {describe, expect, it} from "vitest";

import type {Path} from "effect/Path";

interface SeedSource {
  readonly column: TableColumn;
  readonly tableName: string;
}

type StoredRow = Readonly<Record<string, unknown>>;

interface StoredTable {
  readonly columns: readonly TableColumn[];
  readonly foreignKeys: readonly TableForeignKey[];
  readonly name: string;
}

interface TableColumn {
  readonly cid: number;
  readonly dflt_value: null | string;
  readonly name: string;
  readonly notnull: number;
  readonly pk: number;
  readonly type: string;
}

interface TableForeignKey {
  readonly from: string;
  readonly table: string;
  readonly to: string;
}

interface TableSnapshot extends StoredTable {
  readonly rows: readonly StoredRow[];
}

const MIGRATIONS_FOLDER_PATH = join(import.meta.dirname, "..", MIGRATIONS.FOLDER);
const MIGRATION_NAMES = readdirSync(MIGRATIONS_FOLDER_PATH).toSorted();

// A backup an earlier update left, which the next backup replaces.
const OLDER_BACKUP_FILE_NAME = DATABASE_BACKUP.FILE_NAME("00000000000000_older");

// Every table gets a row with every column set, and one with only the columns SQLite requires.
const SEED_ROWS = {FULL: 1, REQUIRED_ONLY: 2} as const;

// SQLite gives a column whose declared type contains INT integer affinity.
const INTEGER_AFFINITY = /INT/iu;

const findSeedSource = Effect.fn("findSeedSource")(function* (
  storedTable: StoredTable,
  column: TableColumn,
  storedTables: readonly StoredTable[]
) {
  const foreignKey = storedTable.foreignKeys.find((tableForeignKey) => tableForeignKey.from === column.name);
  const ownSource: SeedSource = {column, tableName: storedTable.name};
  if (foreignKey === undefined) return ownSource;
  const referencedColumn = storedTables
    .filter((referencedTable) => referencedTable.name === foreignKey.table)
    .flatMap((referencedTable) => referencedTable.columns)
    .find((referencedTableColumn) => referencedTableColumn.name === foreignKey.to);
  if (referencedColumn === undefined)
    return yield* Effect.die(new Error(`${storedTable.name}.${column.name} references a column that isn't there`));
  const referencedSource: SeedSource = {column: referencedColumn, tableName: foreignKey.table};

  return referencedSource;
});

// A value no other row or column holds, so one that lands in another row or column shows.
const makeSeedValue = Effect.fn("makeSeedValue")(function* (seedSource: SeedSource, rowNumber: number) {
  return INTEGER_AFFINITY.test(seedSource.column.type)
    ? rowNumber * 1000 + seedSource.column.cid
    : `${seedSource.tableName}.${seedSource.column.name}.${rowNumber}`;
});

const isRequiredColumn = (column: TableColumn) => column.pk > 0 || (column.notnull === 1 && column.dflt_value === null);

const insertSeedRow = Effect.fn("insertSeedRow")(function* (
  storedTable: StoredTable,
  storedTables: readonly StoredTable[],
  rowNumber: number
) {
  const sql = yield* SqlClient;
  const seededColumns =
    rowNumber === SEED_ROWS.FULL ? storedTable.columns : storedTable.columns.filter(isRequiredColumn);
  const seedValues = yield* Effect.forEach(seededColumns, (column) =>
    Effect.flatMap(findSeedSource(storedTable, column, storedTables), (seedSource) =>
      makeSeedValue(seedSource, rowNumber)
    )
  );
  const seedRow = Object.fromEntries(
    Array.zip(
      Array.map(seededColumns, (column) => column.name),
      seedValues
    )
  );

  yield* sql`INSERT INTO ${sql(storedTable.name)} ${sql.insert(seedRow)}`;
});

// Foreign keys are off while seeding, so the tables fill in any order; expectDatabaseIntact checks every reference.
const seedEveryTable = Effect.fn("seedEveryTable")(function* (storedTables: readonly StoredTable[]) {
  const sql = yield* SqlClient;
  yield* sql`PRAGMA foreign_keys = OFF`;
  yield* Effect.forEach(storedTables, (storedTable) =>
    Effect.forEach(Object.values(SEED_ROWS), (rowNumber) => insertSeedRow(storedTable, storedTables, rowNumber))
  );
  yield* sql`PRAGMA foreign_keys = ON`;
});

const readStoredTable = Effect.fn("readStoredTable")(function* (tableName: string) {
  const sql = yield* SqlClient;
  const columns = yield* sql<TableColumn>`SELECT * FROM pragma_table_info(${tableName})`;
  const foreignKeys = yield* sql<TableForeignKey>`SELECT * FROM pragma_foreign_key_list(${tableName})`;
  const storedTable: StoredTable = {columns, foreignKeys, name: tableName};

  return storedTable;
});

// The app's tables: neither SQLite's own nor the migrator's record of the migrations it ran.
const readStoredTables = Effect.fn("readStoredTables")(function* () {
  const sql = yield* SqlClient;
  const tableNames = yield* sql<{readonly name: string}>`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite%' AND name != '__drizzle_migrations'
    ORDER BY name`;

  return yield* Effect.forEach(tableNames, (tableName) => readStoredTable(tableName.name));
});

// node:sqlite returns rows without a prototype.
const readTableSnapshot = Effect.fn("readTableSnapshot")(function* (storedTable: StoredTable) {
  const sql = yield* SqlClient;
  const rows = yield* sql<StoredRow>`SELECT * FROM ${sql(storedTable.name)} ORDER BY id`;
  const tableSnapshot: TableSnapshot = {...storedTable, rows: Array.map(rows, (row) => ({...row}))};

  return tableSnapshot;
});

const readTableSnapshots = Effect.fn("readTableSnapshots")(function* () {
  const storedTables = yield* readStoredTables();

  return yield* Effect.forEach(storedTables, readTableSnapshot);
});

const pickColumns = (row: StoredRow, columns: readonly TableColumn[]) =>
  Object.fromEntries(Array.map(columns, (column) => [column.name, row[column.name]]));

const expectEveryRowKept = Effect.fn("expectEveryRowKept")(function* (
  snapshotsBefore: readonly TableSnapshot[],
  snapshotsAfter: readonly TableSnapshot[]
) {
  const keptTables = Array.map(snapshotsBefore, (snapshotBefore) => {
    const snapshotAfter = snapshotsAfter.find((tableSnapshot) => tableSnapshot.name === snapshotBefore.name);
    const keptRows =
      snapshotAfter === undefined
        ? undefined
        : Array.map(snapshotAfter.rows, (row) => pickColumns(row, snapshotBefore.columns));

    return {name: snapshotBefore.name, rows: keptRows};
  });

  expect(keptTables).toStrictEqual(
    Array.map(snapshotsBefore, (snapshotBefore) => ({name: snapshotBefore.name, rows: snapshotBefore.rows}))
  );
});

const evaluateColumnDefault = Effect.fn("evaluateColumnDefault")(function* (column: TableColumn) {
  if (column.dflt_value === null) return null;
  const sql = yield* SqlClient;
  const [evaluatedDefault] = yield* sql.unsafe<{readonly defaultValue: unknown}>(
    `SELECT ${column.dflt_value} AS defaultValue`
  );
  if (evaluatedDefault === undefined) return yield* Effect.die(new Error(`${column.name}'s default gave no value`));

  return evaluatedDefault.defaultValue;
});

// shortcut: a new column whose default reads the clock can differ by a second; compare its type if one appears.
const expectNewColumnsAtDefault = Effect.fn("expectNewColumnsAtDefault")(function* (
  snapshotsBefore: readonly TableSnapshot[],
  snapshotsAfter: readonly TableSnapshot[]
) {
  const columnKeysBefore = new Set(
    snapshotsBefore.flatMap((snapshotBefore) =>
      Array.map(snapshotBefore.columns, (column) => `${snapshotBefore.name}.${column.name}`)
    )
  );
  for (const snapshotAfter of snapshotsAfter)
    for (const column of snapshotAfter.columns.filter(
      (columnAfter) => !columnKeysBefore.has(`${snapshotAfter.name}.${columnAfter.name}`)
    )) {
      const defaultValue = yield* evaluateColumnDefault(column);
      expect(Array.map(snapshotAfter.rows, (row) => row[column.name])).toStrictEqual(
        Array.map(snapshotAfter.rows, () => defaultValue)
      );
    }
});

const expectDatabaseIntact = Effect.fn("expectDatabaseIntact")(function* () {
  const sql = yield* SqlClient;
  const integrityResults = yield* sql<{readonly integrity_check: string}>`PRAGMA integrity_check`;
  const brokenReferences = yield* sql`PRAGMA foreign_key_check`;
  const appliedMigrations = yield* sql<{
    readonly name: string;
  }>`SELECT name FROM ${sql(MIGRATIONS.RECORD_TABLE)} ORDER BY id`;

  expect(Array.map(integrityResults, (integrityResult) => integrityResult.integrity_check)).toStrictEqual(["ok"]);
  expect(brokenReferences).toHaveLength(0);
  expect(Array.map(appliedMigrations, (appliedMigration) => appliedMigration.name)).toStrictEqual(MIGRATION_NAMES);
});

const copyEarlierMigrations = Effect.fn("copyEarlierMigrations")(function* (
  testFolderPath: string,
  appliedMigrationCount: number
) {
  const fileSystem = yield* FileSystem;
  const earlierMigrationsFolderPath = join(testFolderPath, "earlierMigrations");
  yield* fileSystem.makeDirectory(earlierMigrationsFolderPath);
  yield* Effect.forEach(MIGRATION_NAMES.slice(0, appliedMigrationCount), (migrationName) =>
    fileSystem.copy(join(MIGRATIONS_FOLDER_PATH, migrationName), join(earlierMigrationsFolderPath, migrationName))
  );

  return earlierMigrationsFolderPath;
});

// A backup copied as files has its write-ahead log beside it.
const listBackupFileNames = Effect.fn("listBackupFileNames")(function* (testFolderPath: string) {
  const fileSystem = yield* FileSystem;
  const testFolderFileNames = yield* fileSystem.readDirectory(testFolderPath);

  return Array.filter(
    Array.sort(testFolderFileNames, Order.String),
    (fileName) =>
      String.startsWith(DATABASE_BACKUP.FILE_NAME_PREFIX)(fileName) &&
      !String.endsWith(DATABASE_BACKUP.WRITE_AHEAD_LOG_SUFFIX)(fileName)
  );
});

const expectBackupOfRowsBefore = Effect.fn("expectBackupOfRowsBefore")(function* (
  testFolderPath: string,
  appliedMigrationCount: number,
  snapshotsBefore: readonly TableSnapshot[]
) {
  const backupFileNames = yield* listBackupFileNames(testFolderPath);
  const firstPendingMigrationName = MIGRATION_NAMES[appliedMigrationCount];
  if (firstPendingMigrationName === undefined) {
    expect(backupFileNames).toStrictEqual([OLDER_BACKUP_FILE_NAME]);

    return;
  }
  const backupFileName = DATABASE_BACKUP.FILE_NAME(firstPendingMigrationName);
  const backupLayer = SqliteClient.layer({filename: join(testFolderPath, backupFileName), readonly: true});

  expect(backupFileNames).toStrictEqual([backupFileName]);
  expect(yield* Effect.provide(readTableSnapshots(), backupLayer)).toStrictEqual(snapshotsBefore);
});

const checkUpgradeFrom = Effect.fn("checkUpgradeFrom")(function* (
  testFolderPath: string,
  appliedMigrationCount: number
) {
  const fileSystem = yield* FileSystem;
  yield* applyPendingMigrations(yield* copyEarlierMigrations(testFolderPath, appliedMigrationCount));
  yield* seedEveryTable(yield* readStoredTables());
  yield* fileSystem.writeFileString(join(testFolderPath, OLDER_BACKUP_FILE_NAME), "");
  const snapshotsBefore = yield* readTableSnapshots();

  yield* applyPendingMigrations(MIGRATIONS_FOLDER_PATH);
  const snapshotsAfter = yield* readTableSnapshots();
  yield* expectEveryRowKept(snapshotsBefore, snapshotsAfter);
  yield* expectNewColumnsAtDefault(snapshotsBefore, snapshotsAfter);
  yield* expectDatabaseIntact();
  yield* expectBackupOfRowsBefore(testFolderPath, appliedMigrationCount, snapshotsBefore);
  const backupFileNames = yield* listBackupFileNames(testFolderPath);

  yield* applyPendingMigrations(MIGRATIONS_FOLDER_PATH);
  expect(yield* readTableSnapshots()).toStrictEqual(snapshotsAfter);
  expect(yield* listBackupFileNames(testFolderPath)).toStrictEqual(backupFileNames);
});

// A new database holds nothing to back up.
const checkNewDatabase = Effect.fn("checkNewDatabase")(function* (testFolderPath: string) {
  yield* applyPendingMigrations(MIGRATIONS_FOLDER_PATH);
  yield* expectDatabaseIntact();
  expect(yield* listBackupFileNames(testFolderPath)).toStrictEqual([]);
});

const runInTestFolder = Effect.fn("runInTestFolder")(
  function* (check: (testFolderPath: string) => Effect.Effect<void, unknown, FileSystem | Path | SqlClient>) {
    const fileSystem = yield* FileSystem;
    const testFolderPath = yield* fileSystem.makeTempDirectoryScoped();
    const databaseLayer = SqliteClient.layer({filename: join(testFolderPath, DATABASE_FILE.FILE_NAME)});

    yield* Effect.provide(check(testFolderPath), databaseLayer);
  },
  Effect.scoped,
  Effect.provide(NodeServices.layer)
);

describe("migrations", () => {
  it("a new database runs every migration", () => Effect.runPromise(runInTestFolder(checkNewDatabase)));

  for (const [migrationIndex, migrationName] of MIGRATION_NAMES.entries())
    it(`a database at ${migrationName} keeps every row when it migrates to the newest`, () =>
      Effect.runPromise(runInTestFolder((testFolderPath) => checkUpgradeFrom(testFolderPath, migrationIndex + 1))));
});

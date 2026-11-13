import {
  CORE_MODULE,
  FILE_ROLES,
  findMainFileName,
  findSourceRoot,
  getKindFolderRole,
  MODULES_FOLDER,
  parseFileName,
  showPath
} from "@pkg/eslint/src/folderStructure/folderStructure.utils.ts";
import {existsSync, readdirSync, readFileSync, statSync} from "node:fs";
import {basename, dirname, join, relative, sep} from "node:path";

import type {Rule} from "eslint";

// aggregor/single-consumer: code starts as deep in the tree as it can and moves up only on a second consumer (the
// folder-structure skill's promotion ladder). It flags a file nothing imports, a .type.ts only one file imports, a core
// file only one feature module imports, and a file whose importers all sit in one unit below its level.
//
// shortcut: it reads every file's imports from the app's src, and ESLint's cache doesn't know a file's report depends on
// other files, so a cached run can miss a change elsewhere; CI's uncached run catches it. Move to a project-wide check if
// that ever bites.

type ConsumerReport = Readonly<{data: Record<string, string>; messageId: string}>;

// Who imports each file, by absolute path.
interface ImportGraph {
  readonly builtAt: number;
  readonly importersByFile: ReadonlyMap<string, ReadonlySet<string>>;
}

// A run lints many files in a moment, and an editor relints one as it changes.
const IMPORT_GRAPH_LIFETIME_MS = 2000;
const APP_IMPORT = /(?:from|import)\s*\(?\s*["']@\/(?<importPath>[^"']+)["']/gu;
const IMPORTING_FILE = /\.(?:ts|tsx)$/u;
const RESOLVED_EXTENSIONS = ["", ".ts", ".tsx"];
const ENTRY_FILE_NAMES = new Set(["main.tsx"]);
const importGraphs = new Map<string, ImportGraph>();

const resolveAppImport = (sourceRootPath: string, importPath: string) =>
  RESOLVED_EXTENSIONS.map((extension) => join(sourceRootPath, `${importPath}${extension}`)).find(
    (candidatePath) => existsSync(candidatePath) && statSync(candidatePath).isFile()
  );

const buildImportGraph = (sourceRootPath: string): ImportGraph => {
  const importersByFile = new Map<string, Set<string>>();
  const importingFiles = readdirSync(sourceRootPath, {recursive: true, withFileTypes: true}).filter(
    (entry) => entry.isFile() && IMPORTING_FILE.test(entry.name)
  );
  const imports = importingFiles.flatMap((importingFile) => {
    const importerPath = join(importingFile.parentPath, importingFile.name);
    const importPaths = Array.from(readFileSync(importerPath, "utf8").matchAll(APP_IMPORT), (importMatch) =>
      importMatch.groups === undefined ? undefined : importMatch.groups.importPath
    );

    return importPaths.flatMap((importPath) => {
      const importedPath = importPath === undefined ? undefined : resolveAppImport(sourceRootPath, importPath);

      return importedPath === undefined || importedPath === importerPath ? [] : [{importedPath, importerPath}];
    });
  });
  for (const appImport of imports) {
    const importers = importersByFile.get(appImport.importedPath);
    if (importers === undefined) importersByFile.set(appImport.importedPath, new Set([appImport.importerPath]));
    if (importers !== undefined) importers.add(appImport.importerPath);
  }

  return {builtAt: Date.now(), importersByFile};
};

const readImporters = (sourceRootPath: string, filePath: string): readonly string[] => {
  const cachedGraph = importGraphs.get(sourceRootPath);
  const isFresh = cachedGraph !== undefined && Date.now() - cachedGraph.builtAt < IMPORT_GRAPH_LIFETIME_MS;
  const importGraph = isFresh ? cachedGraph : buildImportGraph(sourceRootPath);
  importGraphs.set(sourceRootPath, importGraph);

  const importers = importGraph.importersByFile.get(filePath);

  return importers === undefined ? [] : [...importers];
};

const getTopModuleName = (sourceRootPath: string, filePath: string) => {
  const [firstFolder, moduleName] = relative(sourceRootPath, filePath).split(sep);

  return firstFolder === MODULES_FOLDER ? moduleName : undefined;
};

// The one unit below the file's level that holds every importer, looking through a kind's folder (components/) to the
// unit inside it.
const findConsumingUnit = (levelPath: string, importerPaths: readonly string[]) => {
  const importerParts = importerPaths.map((importerPath) => relative(levelPath, importerPath).split(sep));
  const sharedPart = (partIndex: number) => {
    const partNames = new Set(
      importerParts.map((pathParts) => (pathParts.length > partIndex + 1 ? pathParts[partIndex] : ""))
    );
    const [partName] = partNames;

    return partNames.size === 1 && partName !== undefined && partName !== "" && partName !== ".."
      ? partName
      : undefined;
  };
  const childName = sharedPart(0);
  if (childName === undefined || childName === MODULES_FOLDER) return undefined;
  if (getKindFolderRole(childName) === undefined) return join(levelPath, childName);
  const unitName = sharedPart(1);

  return unitName === undefined ? undefined : join(levelPath, childName, unitName);
};

// A level's main file stands for its folder, whose level is the folder above.
const findUnitPath = (filePath: string) =>
  findMainFileName(dirname(filePath)) === basename(filePath) ? dirname(filePath) : filePath;

const findCoreReport = (
  filePath: string,
  importerPaths: readonly string[],
  sourceRootPath: string
): ConsumerReport | undefined => {
  if (getTopModuleName(sourceRootPath, filePath) !== CORE_MODULE) return undefined;
  const importerModuleNames = new Set(
    importerPaths.map((importerPath) => getTopModuleName(sourceRootPath, importerPath))
  );
  const [moduleName] = importerModuleNames;
  if (importerModuleNames.size !== 1 || moduleName === undefined || moduleName === CORE_MODULE) return undefined;

  return {data: {fileName: basename(filePath), moduleName}, messageId: "coreSingleModule"};
};

const findLocalReport = (
  filePath: string,
  importerPaths: readonly string[],
  sourceRootPath: string
): ConsumerReport | undefined => {
  const unitPath = findUnitPath(filePath);
  const outsideImporterPaths = importerPaths.filter((importerPath) => !importerPath.startsWith(`${unitPath}${sep}`));
  if (outsideImporterPaths.length === 0) return undefined;
  const consumingUnitPath = findConsumingUnit(dirname(unitPath), outsideImporterPaths);
  if (consumingUnitPath === undefined) return undefined;

  return {
    data: {consumer: showPath(consumingUnitPath, sourceRootPath), fileName: basename(filePath)},
    messageId: "singleUnitConsumer"
  };
};

// A building block's file holds only the block and its Props type, so its other types sit in a .type.ts even with one
// consumer.
const isBlockFile = (filePath: string) => {
  const role = parseFileName(basename(filePath)).role;
  const roleInfo = role === undefined ? undefined : FILE_ROLES[role];

  return roleInfo !== undefined && roleInfo.makeBlockName !== undefined;
};

const findConsumerReport = (filePath: string, sourceRootPath: string): ConsumerReport | undefined => {
  const fileName = basename(filePath);
  if (dirname(filePath) === sourceRootPath && ENTRY_FILE_NAMES.has(fileName)) return undefined;
  const importerPaths = readImporters(sourceRootPath, filePath);
  const [onlyImporterPath] = importerPaths;
  if (onlyImporterPath === undefined) return {data: {fileName}, messageId: "unused"};
  if (parseFileName(fileName).role === "type" && importerPaths.length === 1 && !isBlockFile(onlyImporterPath)) {
    return {data: {fileName, importer: showPath(onlyImporterPath, sourceRootPath)}, messageId: "typeSingleConsumer"};
  }

  const coreReport = findCoreReport(filePath, importerPaths, sourceRootPath);

  return coreReport === undefined ? findLocalReport(filePath, importerPaths, sourceRootPath) : coreReport;
};

export const singleConsumerRule: Rule.RuleModule = {
  create(context) {
    const filePath = context.physicalFilename;
    const sourceRootPath = findSourceRoot(filePath);

    return {
      Program() {
        if (sourceRootPath === undefined) return;
        const consumerReport = findConsumerReport(filePath, sourceRootPath);
        if (consumerReport === undefined) return;
        context.report({data: consumerReport.data, loc: {column: 0, line: 1}, messageId: consumerReport.messageId});
      }
    };
  },
  meta: {
    docs: {description: "Keep code beside its only consumer until a second one needs it."},
    messages: {
      coreSingleModule:
        "Only the `{{moduleName}}` module uses `{{fileName}}`. core holds what several modules share, and code moves " +
        "up only on its second consumer, so until another module needs it, it lives in `modules/{{moduleName}}/`. " +
        "Move it there.",
      singleUnitConsumer:
        "Only `{{consumer}}` uses `{{fileName}}`. Code starts as deep in the tree as it can and moves up on a second " +
        "consumer, so the tree shows what is shared and what is private. Move it into `{{consumer}}/`.",
      typeSingleConsumer:
        "Only `{{importer}}` uses the types in `{{fileName}}`. A type one cog file (utils, constants, service) uses is " +
        "declared at that file's top, and moves to a .type.ts once a second file needs it; only a building block's " +
        "file keeps its other types in a .type.ts. Move them into `{{importer}}` and delete this file.",
      unused:
        "Nothing imports `{{fileName}}`. Delete it, or import it where it is meant to be used: code no one runs is " +
        "only something to keep in step."
    },
    schema: [],
    type: "suggestion"
  }
};

import {existsSync, readdirSync} from "node:fs";
import {basename, dirname, join, relative, sep} from "node:path";

// What the folder-structure rules (.claude/skills/folder-structure) know about a front end's files: the role each file's
// suffix names, the folder each kind of file gathers in, and where the app's src begins.

export interface ParsedFileName {
  readonly extension: string;
  readonly role: string | undefined;
  readonly roleCount: number;
  readonly stem: string;
}

interface FileRole {
  // The extension the role's files take: a hook, store, context or cog holds no JSX, and the rest render.
  readonly extension: "ts" | "tsx";
  // The folder a level's second file of the role moves into, with the first.
  readonly kindFolder: string;
  // The name of the one block a building block's file exports, from its stem in PascalCase; cogs hold many.
  readonly makeBlockName?: (pascalCaseStem: string) => string;
  // What the role holds, in a message.
  readonly title: string;
}

export const FILE_ROLES: Readonly<Record<string, FileRole>> = {
  component: {extension: "tsx", kindFolder: "components", makeBlockName: (stem) => stem, title: "component"},
  constant: {extension: "ts", kindFolder: "constants", title: "constants file"},
  context: {extension: "ts", kindFolder: "contexts", makeBlockName: (stem) => `${stem}Context`, title: "context"},
  hook: {extension: "ts", kindFolder: "hooks", makeBlockName: (stem) => `use${stem}`, title: "hook"},
  icon: {extension: "tsx", kindFolder: "icons", makeBlockName: (stem) => `${stem}Icon`, title: "icon"},
  layout: {extension: "tsx", kindFolder: "layouts", makeBlockName: (stem) => `${stem}Layout`, title: "layout"},
  provider: {extension: "tsx", kindFolder: "providers", makeBlockName: (stem) => `${stem}Provider`, title: "provider"},
  schema: {extension: "ts", kindFolder: "schemas", title: "schemas file"},
  service: {extension: "ts", kindFolder: "services", title: "service"},
  store: {extension: "ts", kindFolder: "stores", makeBlockName: (stem) => `use${stem}Store`, title: "store"},
  type: {extension: "ts", kindFolder: "types", title: "types file"},
  useCase: {extension: "tsx", kindFolder: "useCases", makeBlockName: (stem) => stem, title: "use case"},
  utils: {extension: "ts", kindFolder: "utils", title: "utils file"}
};

// The role a level's main file plays, most specific first, when several files carry the folder's name.
const MAIN_FILE_ROLE_ORDER = ["useCase", "layout", "provider", "component", "icon", "context", "store", "hook"];
const KIND_FOLDER_ROLES = new Map(Object.entries(FILE_ROLES).map(([role, roleInfo]) => [roleInfo.kindFolder, role]));
const CAMEL_CASE_NAME = /^[a-z][\dA-Za-z]*$/u;
const NAME_WORD_SEPARATORS = /[\s_-]+(?<letter>.)?/gu;
const SOURCE_FILE_EXTENSION = /\.(?:ts|tsx)$/u;
const TRAILING_SLASH = /\/$/u;

// The app's entry mounts the view; the framework decides its name and what it holds.
const ENTRY_FILE_NAMES = new Set(["main.tsx"]);

export const MODULES_FOLDER = "modules";
export const CORE_MODULE = "core";

export const isCamelCaseName = (name: string) => CAMEL_CASE_NAME.test(name);

// `session-row` and `SessionRow` both suggest `sessionRow`.
export const toCamelCaseName = (name: string) => {
  const joinedName = name.replaceAll(NAME_WORD_SEPARATORS, (_separator, letter: string | undefined) =>
    letter === undefined ? "" : letter.toUpperCase()
  );

  return `${joinedName.charAt(0).toLowerCase()}${joinedName.slice(1)}`;
};

export const toPascalCaseName = (name: string) => `${name.charAt(0).toUpperCase()}${name.slice(1)}`;

// A file is <stem>.<role>.<extension>, or <stem>.tsx for a component.
export const parseFileName = (fileName: string): ParsedFileName => {
  const nameParts = fileName.split(".");
  const [stem = "", ...restParts] = nameParts;
  const lastPart = restParts.at(-1);
  const extension = lastPart === undefined ? "" : lastPart;
  const roleParts = restParts.slice(0, -1);
  const role = roleParts.length === 0 && extension === "tsx" ? "component" : roleParts[0];

  return {extension, role, roleCount: roleParts.length, stem};
};

export const getKindFolderRole = (folderName: string) => KIND_FOLDER_ROLES.get(folderName);

// The app's src: the deepest folder named src above the file.
export const findSourceRoot = (filePath: string) => {
  const pathParts = filePath.split(sep);
  const sourceIndex = pathParts.lastIndexOf("src");

  return sourceIndex === -1 ? undefined : pathParts.slice(0, sourceIndex + 1).join(sep);
};

// src, modules/, and each module always exist, even with one thing in them.
export const isFixedFolder = (folderPath: string, sourceRootPath: string) =>
  folderPath === sourceRootPath ||
  basename(folderPath) === MODULES_FOLDER ||
  basename(dirname(folderPath)) === MODULES_FOLDER;

export const listFolderEntries = (folderPath: string) =>
  readdirSync(folderPath, {withFileTypes: true}).filter((entry) => !entry.name.startsWith("."));

// A unit folder's main file: the building block named after the folder, its most specific role first.
export const findMainFileName = (folderPath: string) => {
  const folderName = basename(folderPath);
  const mainFileNames = MAIN_FILE_ROLE_ORDER.map((role) => {
    const roleInfo = FILE_ROLES[role];
    if (roleInfo === undefined) return undefined;
    const fileName = role === "component" ? `${folderName}.tsx` : `${folderName}.${role}.${roleInfo.extension}`;

    return existsSync(join(folderPath, fileName)) ? fileName : undefined;
  });

  return mainFileNames.find((fileName) => fileName !== undefined);
};

// The role a level's entry plays: a file's own, or a unit folder's main file's.
export const getEntryRole = (folderPath: string, entryName: string, isFolder: boolean) => {
  if (!isFolder) return SOURCE_FILE_EXTENSION.test(entryName) ? parseFileName(entryName).role : undefined;
  const mainFileName = findMainFileName(join(folderPath, entryName));

  return mainFileName === undefined ? undefined : parseFileName(mainFileName).role;
};

// A path as messages show it: from the app's src, with forward slashes.
export const showPath = (absolutePath: string, sourceRootPath: string) =>
  `src/${relative(sourceRootPath, absolutePath).split(sep).join("/")}`.replace(TRAILING_SLASH, "");

export const isAppEntry = (filePath: string, sourceRootPath: string) =>
  dirname(filePath) === sourceRootPath && ENTRY_FILE_NAMES.has(basename(filePath));

export const isSourceFile = (fileName: string) => SOURCE_FILE_EXTENSION.test(fileName);

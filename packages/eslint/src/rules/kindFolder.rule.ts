import {
  FILE_ROLES,
  findMainFileName,
  findSourceRoot,
  getEntryRole,
  getKindFolderRole,
  isFixedFolder,
  isSourceFile,
  listFolderEntries,
  parseFileName,
  showPath
} from "@pkg/eslint/src/folderStructure/folderStructure.utils.ts";
import {basename, dirname} from "node:path";

import type {Rule} from "eslint";

type FolderReport = Readonly<{data: Record<string, string>; messageId: string}>;

// A store always sits in its module's stores/ folder, even alone, beside its helpers there.
const ALWAYS_FOLDED_KINDS = new Set(["store"]);

const getRoleTitle = (role: string) => {
  const roleInfo = FILE_ROLES[role];

  return roleInfo === undefined ? role : roleInfo.title;
};

const findKindFolderReports = (filePath: string, kindRole: string, sourceRootPath: string): FolderReport[] => {
  const folderPath = dirname(filePath);
  const fileName = basename(filePath);
  const kindFolder = basename(folderPath);
  const fileRole = parseFileName(fileName).role;
  const folderEntries = listFolderEntries(folderPath);
  const roleData = {kindFolder, kindRole: getRoleTitle(kindRole)};
  const wrongKindReports =
    fileRole === undefined || fileRole === kindRole
      ? []
      : [{data: {...roleData, fileName, role: getRoleTitle(fileRole)}, messageId: "wrongKind"}];
  const lonelyData = {
    folder: showPath(folderPath, sourceRootPath),
    parent: showPath(dirname(folderPath), sourceRootPath),
    role: getRoleTitle(kindRole)
  };
  const lonelyReports =
    folderEntries.length === 1 && folderEntries[0] !== undefined && !ALWAYS_FOLDED_KINDS.has(kindRole)
      ? [{data: {...lonelyData, entry: folderEntries[0].name}, messageId: "lonelyKindFolder"}]
      : [];

  return [...wrongKindReports, ...lonelyReports];
};

const listSameRoleEntryNames = (folderPath: string, role: string, mainFileName: string | undefined) =>
  listFolderEntries(folderPath)
    .filter((entry) => entry.name !== mainFileName && getKindFolderRole(entry.name) === undefined)
    .filter((entry) => entry.isDirectory() || isSourceFile(entry.name))
    .filter((entry) => getEntryRole(folderPath, entry.name, entry.isDirectory()) === role)
    .map((entry) => entry.name);

const findTwoOfAKindReports = (filePath: string, sourceRootPath: string): FolderReport[] => {
  const folderPath = dirname(filePath);
  const fileName = basename(filePath);
  const mainFileName = findMainFileName(folderPath);
  const role = parseFileName(fileName).role;
  const roleInfo = role === undefined ? undefined : FILE_ROLES[role];
  if (role === undefined || roleInfo === undefined || fileName === mainFileName) return [];
  const sameRoleNames = listSameRoleEntryNames(folderPath, role, mainFileName);
  if (sameRoleNames.length < 2) return [];
  const folder = showPath(folderPath, sourceRootPath);
  const data = {count: String(sameRoleNames.length), folder, names: sameRoleNames.join(", ")};

  return [{data: {...data, kindFolder: roleInfo.kindFolder, role: roleInfo.title}, messageId: "twoOfAKind"}];
};

const findLonelyUnitFolderReports = (filePath: string, sourceRootPath: string): FolderReport[] => {
  const folderPath = dirname(filePath);
  if (isFixedFolder(folderPath, sourceRootPath) || listFolderEntries(folderPath).length > 1) return [];
  const data = {
    fileName: basename(filePath),
    folder: showPath(folderPath, sourceRootPath),
    parent: showPath(dirname(folderPath), sourceRootPath)
  };

  return [{data, messageId: "lonelyUnitFolder"}];
};

const findFolderReports = (filePath: string, sourceRootPath: string) => {
  const folderPath = dirname(filePath);
  if (folderPath === sourceRootPath) return [];
  const kindRole = getKindFolderRole(basename(folderPath));

  if (kindRole !== undefined) return findKindFolderReports(filePath, kindRole, sourceRootPath);

  return [...findTwoOfAKindReports(filePath, sourceRootPath), ...findLonelyUnitFolderReports(filePath, sourceRootPath)];
};

export const kindFolderRule: Rule.RuleModule = {
  create(context) {
    const filePath = context.physicalFilename;
    const sourceRootPath = findSourceRoot(filePath);

    return {
      Program() {
        if (sourceRootPath === undefined) return;
        for (const folderReport of findFolderReports(filePath, sourceRootPath)) {
          context.report({data: folderReport.data, loc: {column: 0, line: 1}, messageId: folderReport.messageId});
        }
      }
    };
  },
  meta: {
    docs: {description: "Keep one file of a kind beside a level's main file, and gather two in the kind's folder."},
    messages: {
      lonelyKindFolder:
        "`{{folder}}/` holds only `{{entry}}`. A kind's folder comes with a level's second {{role}} and goes when one " +
        "is left, so the tree holds no folder it doesn't need. Move `{{entry}}` up to `{{parent}}/` and delete " +
        "`{{folder}}/`.",
      lonelyUnitFolder:
        "`{{folder}}/` holds only `{{fileName}}`. A unit gets a folder once it has files of its own; alone, it is one " +
        "file. Move `{{fileName}}` up to `{{parent}}/` and delete `{{folder}}/`.",
      twoOfAKind:
        "`{{folder}}` holds {{count}} of the {{role}} kind besides its main file: {{names}}. A level keeps one of a " +
        "kind next to its main file, and the second gives the kind its folder, so a level reads at a glance. Move " +
        "them into `{{folder}}/{{kindFolder}}/`.",
      wrongKind:
        "`{{fileName}}` is a {{role}} inside `{{kindFolder}}/`, which holds the {{kindRole}} kind only, so its name " +
        "says what is inside. Move it beside `{{kindFolder}}/`, or into its own kind's folder there once its level " +
        "has two."
    },
    schema: [],
    type: "suggestion"
  }
};

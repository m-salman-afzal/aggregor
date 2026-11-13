import {
  FILE_ROLES,
  findSourceRoot,
  isAppEntry,
  isCamelCaseName,
  parseFileName,
  showPath,
  toCamelCaseName
} from "@pkg/eslint/src/folderStructure/folderStructure.utils.ts";
import {basename, dirname, relative, sep} from "node:path";

import type {Rule} from "eslint";

// aggregor/file-role: a front-end file is named <name>.<role>.ts, or <name>.tsx for a component, camelCase in every
// dotted part and folder, with no index files (the folder-structure skill's "A file's suffix names its role").

type FileNameReport = Readonly<{data: Record<string, string>; messageId: string}>;

const ROLE_NAMES = Object.keys(FILE_ROLES).join(", ");

const findFolderNameReport = (filePath: string, sourceRootPath: string): FileNameReport | undefined => {
  const folderNames = relative(sourceRootPath, dirname(filePath))
    .split(sep)
    .filter((folderName) => folderName !== "");
  const badFolderName = folderNames.find((folderName) => !isCamelCaseName(folderName));
  if (badFolderName === undefined) return undefined;

  return {data: {name: badFolderName, suggestion: toCamelCaseName(badFolderName)}, messageId: "folderNotCamelCase"};
};

const findRoleReport = (fileName: string): FileNameReport | undefined => {
  const parsedFileName = parseFileName(fileName);
  const stem = parsedFileName.stem;
  if (stem === "index") return {data: {fileName}, messageId: "indexFile"};
  if (parsedFileName.roleCount > 1) {
    const suggestion = `${stem}.${String(parsedFileName.role)}.${parsedFileName.extension}`;

    return {data: {fileName, suggestion}, messageId: "manyRoles"};
  }
  if (parsedFileName.role === undefined) return {data: {fileName, roles: ROLE_NAMES, stem}, messageId: "missingRole"};
  const roleInfo = FILE_ROLES[parsedFileName.role];
  if (roleInfo === undefined)
    return {data: {fileName, role: parsedFileName.role, roles: ROLE_NAMES}, messageId: "unknownRole"};
  if (roleInfo.extension === parsedFileName.extension) return undefined;
  const suggestion =
    parsedFileName.role === "component" ? `${stem}.ts` : `${stem}.${parsedFileName.role}.${roleInfo.extension}`;
  const messageId = roleInfo.extension === "ts" ? "jsxInLogicRole" : "logicInRenderRole";

  return {data: {fileName, role: roleInfo.title, suggestion}, messageId};
};

const findNamePartReport = (fileName: string): FileNameReport | undefined => {
  const nameParts = fileName.split(".").slice(0, -1);
  const badNamePart = nameParts.find((namePart) => !isCamelCaseName(namePart));
  if (badNamePart === undefined) return undefined;
  const suggestion = fileName.replace(badNamePart, toCamelCaseName(badNamePart));

  return {data: {fileName, suggestion}, messageId: "fileNotCamelCase"};
};

const findFileNameReport = (filePath: string, sourceRootPath: string) => {
  const fileName = basename(filePath);
  if (isAppEntry(filePath, sourceRootPath)) return undefined;

  return [findFolderNameReport(filePath, sourceRootPath), findNamePartReport(fileName), findRoleReport(fileName)].find(
    (fileNameReport) => fileNameReport !== undefined
  );
};

export const fileRoleRule: Rule.RuleModule = {
  create(context) {
    const filePath = context.physicalFilename;
    const sourceRootPath = findSourceRoot(filePath);

    return {
      Program() {
        if (sourceRootPath === undefined) return;
        const fileNameReport = findFileNameReport(filePath, sourceRootPath);
        if (fileNameReport === undefined) return;
        context.report({
          data: {...fileNameReport.data, path: showPath(filePath, sourceRootPath)},
          loc: {column: 0, line: 1},
          messageId: fileNameReport.messageId
        });
      }
    };
  },
  meta: {
    docs: {description: "Name each front-end file camelCase, after its unit and its role."},
    messages: {
      fileNotCamelCase:
        "`{{fileName}}` isn't camelCase in every dotted part. Every file and folder name is camelCase, so names read " +
        "and sort the same everywhere. Rename it to `{{suggestion}}`.",
      folderNotCamelCase:
        "The folder `{{name}}` in `{{path}}` isn't camelCase. Every file and folder name is camelCase, so names read " +
        "and sort the same everywhere. Rename it to `{{suggestion}}`.",
      indexFile:
        "`{{fileName}}` is an index file. A unit is a file named after it, never a folder's index, so an import says " +
        "what it gets and nothing re-exports. Rename it after what it holds, such as the folder's name with its role.",
      jsxInLogicRole:
        "`{{fileName}}` is a {{role}}, which holds no JSX, so it is a .ts file. Move the JSX into a component and " +
        "rename this file to `{{suggestion}}`.",
      logicInRenderRole:
        "`{{fileName}}` is a {{role}}, which renders JSX, so it is a .tsx file. Rename it to `{{suggestion}}`, or, " +
        "if it renders nothing, give it the role of what it holds.",
      manyRoles:
        "`{{fileName}}` names more than one role. A file is <name>.<role>.ts, one role a file, so its name says " +
        "exactly what it holds. Rename it to `{{suggestion}}`, or split it by role.",
      missingRole:
        "`{{fileName}}` has no role. A .ts file's suffix names what it holds ({{roles}}), so its name tells a reader " +
        "what is inside; only a component, a .tsx file, goes without one. Rename it to `{{stem}}.<role>.ts`.",
      unknownRole:
        "`.{{role}}` in `{{fileName}}` isn't a role. A file's suffix is one of {{roles}}, so every file's name says " +
        "what it holds in the same words. Rename it with the role of what it holds."
    },
    schema: [],
    type: "suggestion"
  }
};

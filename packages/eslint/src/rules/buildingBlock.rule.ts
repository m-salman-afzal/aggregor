import {
  FILE_ROLES,
  findSourceRoot,
  isAppEntry,
  parseFileName,
  toCamelCaseName,
  toPascalCaseName
} from "@pkg/eslint/src/folderStructure/folderStructure.utils.ts";
import {basename} from "node:path";

import type {Rule} from "eslint";

// aggregor/building-block: a component, hook, context, provider, store, layout, use case or icon file holds that one
// block, exported by name as its file's name says (sessionRow.tsx exports SessionRow, sessionRow.hook.ts useSessionRow),
// takes its input as one `props: <Block>Props`, and holds nothing but the block and that type: helpers, constants and
// other types go to sibling files (the folder-structure skill's "One building block per file"). A store also keeps its
// state and the functions that change it.

interface BlockFile {
  readonly expectedName: string;
  readonly fileName: string;
  readonly propsTypeName: string;
  readonly role: string;
  readonly roleTitle: string;
  readonly stem: string;
}

type BlockReport = Readonly<{data: Record<string, string>; messageId: string}>;

interface ExportedName {
  readonly isType: boolean;
  readonly name: string;
}

// What the rule reads of a top-level statement; typescript-eslint's type declarations aren't in ESLint's types.
interface TopLevelNode {
  readonly declaration?: null | TopLevelNode;
  readonly declarations?: readonly {readonly id: {readonly name?: string}; readonly init?: null | TopLevelNode}[];
  readonly exportKind?: string;
  readonly id?: {readonly name: string} | null;
  readonly name?: string;
  readonly params?: readonly TopLevelNode[];
  readonly specifiers?: readonly {readonly exported: {readonly name?: string}; readonly exportKind?: string}[];
  readonly type: string;
  readonly typeAnnotation?: {readonly typeAnnotation?: {readonly typeName?: {readonly name?: string}}};
}

const RENDERING_ROLES = new Set(["component", "icon", "layout", "provider", "useCase"]);
const TYPE_DECLARATIONS = new Set(["TSEnumDeclaration", "TSInterfaceDeclaration", "TSTypeAliasDeclaration"]);
const FUNCTION_VALUES = new Set(["ArrowFunctionExpression", "FunctionExpression"]);
const IMPORT_STATEMENTS = new Set(["ImportDeclaration", "TSImportEqualsDeclaration"]);
const PASCAL_CASE_NAME = /^[A-Z][\dA-Za-z]*$/u;
const HOOK_NAME = /^use[A-Z]/u;
const PROPS_PARAMETER_NAME = "props";
// What a block's name adds to its file's stem: use and Store for a store, Context for a context, and so on.
const BLOCK_NAME_AFFIXES = /^use(?=[A-Z])|(?:Context|Icon|Layout|Provider|Store)$/gu;

const isTopLevelNode = (value: unknown): value is TopLevelNode =>
  typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";

const findBlockFile = (filePath: string): BlockFile | undefined => {
  const sourceRootPath = findSourceRoot(filePath);
  if (sourceRootPath === undefined || isAppEntry(filePath, sourceRootPath)) return undefined;
  const fileName = basename(filePath);
  const parsedFileName = parseFileName(fileName);
  const roleInfo = parsedFileName.role === undefined ? undefined : FILE_ROLES[parsedFileName.role];
  if (parsedFileName.role === undefined || roleInfo === undefined || roleInfo.makeBlockName === undefined)
    return undefined;
  // A stem that isn't camelCase is aggregor/file-role's to report; the block's name follows the stem it suggests.
  const camelCaseStem = toCamelCaseName(parsedFileName.stem);
  const expectedName = roleInfo.makeBlockName(toPascalCaseName(camelCaseStem));

  return {
    expectedName,
    fileName,
    propsTypeName: `${toPascalCaseName(expectedName)}Props`,
    role: parsedFileName.role,
    roleTitle: roleInfo.title,
    stem: camelCaseStem
  };
};

const getDeclaredNames = (declaration: TopLevelNode) => {
  if (declaration.declarations !== undefined) {
    return declaration.declarations.flatMap((declarator) =>
      declarator.id.name === undefined ? [] : [declarator.id.name]
    );
  }

  return declaration.id === undefined || declaration.id === null ? [] : [declaration.id.name];
};

// The names an export statement exports, each a value or a type.
const listExports = (statement: TopLevelNode): ExportedName[] => {
  const declaration = statement.declaration;
  if (declaration !== undefined && declaration !== null) {
    const isType = TYPE_DECLARATIONS.has(declaration.type);

    return getDeclaredNames(declaration).map((name) => ({isType, name}));
  }

  return (statement.specifiers === undefined ? [] : statement.specifiers).flatMap((specifier) =>
    specifier.exported.name === undefined
      ? []
      : [
          {
            isType: specifier.exportKind === "type" || statement.exportKind === "type",
            name: specifier.exported.name
          }
        ]
  );
};

// A top-level function named like another block of the file's role: a second component, or a second hook.
const isSecondBlockName = (name: string, blockFile: BlockFile) =>
  name !== blockFile.expectedName &&
  (RENDERING_ROLES.has(blockFile.role) ? PASCAL_CASE_NAME.test(name) : HOOK_NAME.test(name));

const unwrapExport = (statement: TopLevelNode) =>
  statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;

const listFunctionNames = (statement: TopLevelNode) => {
  const declaration = unwrapExport(statement);
  if (declaration === undefined || declaration === null) return [];
  if (declaration.type === "FunctionDeclaration") return getDeclaredNames(declaration);
  if (declaration.declarations === undefined) return [];

  return declaration.declarations.flatMap((declarator) =>
    declarator.id.name !== undefined &&
    declarator.init !== undefined &&
    declarator.init !== null &&
    FUNCTION_VALUES.has(declarator.init.type)
      ? [declarator.id.name]
      : []
  );
};

// Where a second block of the role goes: its own file of the same role.
const suggestFileName = (blockName: string, role: string) => {
  const stemName = blockName.replaceAll(BLOCK_NAME_AFFIXES, "");
  const stem = `${stemName.charAt(0).toLowerCase()}${stemName.slice(1)}`;
  const roleInfo = FILE_ROLES[role];
  if (role === "component" || roleInfo === undefined) return `${stem}.tsx`;

  return `${stem}.${role}.${roleInfo.extension}`;
};

const findExportReports = (statements: readonly TopLevelNode[], blockFile: BlockFile): BlockReport[] => {
  const exportedNames = statements
    .filter((statement) => statement.type === "ExportNamedDeclaration")
    .flatMap((statement) => listExports(statement));
  const valueNames = exportedNames
    .filter((exportedName) => !exportedName.isType)
    .map((exportedName) => exportedName.name);
  const [onlyValueName] = valueNames;
  const isWrongName =
    valueNames.length === 1 && onlyValueName !== undefined && onlyValueName !== blockFile.expectedName;
  const blockReports: BlockReport[] = valueNames.includes(blockFile.expectedName)
    ? []
    : [{data: {actualName: String(onlyValueName)}, messageId: isWrongName ? "wrongName" : "missingBlock"}];
  const extraReports = exportedNames
    .filter((exportedName) => exportedName.name !== blockFile.expectedName && (exportedName.isType || !isWrongName))
    .map((exportedName) => ({
      data: {name: exportedName.name},
      messageId: exportedName.isType ? "exportedType" : "extraExport"
    }));
  const defaultReports = statements.some((statement) => statement.type === "ExportDefaultDeclaration")
    ? [{data: {}, messageId: "defaultExport"}]
    : [];

  return [...blockReports, ...extraReports, ...defaultReports];
};

// An exported block is findExportReports' to report.
const findSecondBlockReports = (statements: readonly TopLevelNode[], blockFile: BlockFile): BlockReport[] =>
  statements
    .filter((statement) => statement.type !== "ExportNamedDeclaration")
    .flatMap((statement) => listFunctionNames(statement))
    .filter((name) => isSecondBlockName(name, blockFile))
    .map((name) => ({data: {name, suggestion: suggestFileName(name, blockFile.role)}, messageId: "secondBlock"}));

// The sibling file a declaration that isn't the block belongs in, by what it is.
const suggestSiblingFile = (declaration: TopLevelNode, blockFile: BlockFile) => {
  if (TYPE_DECLARATIONS.has(declaration.type)) return `${blockFile.stem}.type.ts`;
  if (listFunctionNames(declaration).length > 0) return `${blockFile.stem}.utils.ts`;

  return `${blockFile.stem}.constant.ts`;
};

// What sits in the file beside the block and its Props type. A store keeps its state and the functions that change it,
// so only its other types are reported there; exported names and second blocks have reports of their own.
const findExtraDeclarationReports = (statements: readonly TopLevelNode[], blockFile: BlockFile): BlockReport[] =>
  statements
    .filter((statement) => !IMPORT_STATEMENTS.has(statement.type) && statement.type !== "ExportNamedDeclaration")
    .filter((statement) => blockFile.role !== "store" || TYPE_DECLARATIONS.has(statement.type))
    .flatMap((statement) => {
      const names = getDeclaredNames(statement).filter(
        (name) => name !== blockFile.propsTypeName && !isSecondBlockName(name, blockFile)
      );
      if (names.length === 0 && getDeclaredNames(statement).length > 0) return [];
      const suggestion = suggestSiblingFile(statement, blockFile);

      return (names.length === 0 ? ["this statement"] : names).map((name) => ({
        data: {name, suggestion},
        messageId: "extraDeclaration"
      }));
    });

const findBlockFunction = (statements: readonly TopLevelNode[], blockFile: BlockFile) =>
  statements
    .map((statement) => unwrapExport(statement))
    .flatMap((declaration) => {
      if (declaration === undefined || declaration === null) return [];
      if (declaration.type === "FunctionDeclaration")
        return getDeclaredNames(declaration).includes(blockFile.expectedName) ? [declaration] : [];

      return (declaration.declarations === undefined ? [] : declaration.declarations).flatMap((declarator) =>
        declarator.id.name === blockFile.expectedName &&
        declarator.init !== undefined &&
        declarator.init !== null &&
        FUNCTION_VALUES.has(declarator.init.type)
          ? [declarator.init]
          : []
      );
    })
    .at(0);

// A block takes nothing, or one `props` typed with its own Props type.
const findPropertiesReports = (statements: readonly TopLevelNode[], blockFile: BlockFile): BlockReport[] => {
  const blockFunction = findBlockFunction(statements, blockFile);
  if (blockFunction === undefined || blockFunction.params === undefined || blockFunction.params.length === 0) return [];
  const [onlyParameter] = blockFunction.params;
  const parameterTypeName =
    onlyParameter === undefined ||
    onlyParameter.typeAnnotation === undefined ||
    onlyParameter.typeAnnotation.typeAnnotation === undefined ||
    onlyParameter.typeAnnotation.typeAnnotation.typeName === undefined
      ? undefined
      : onlyParameter.typeAnnotation.typeAnnotation.typeName.name;
  const isPropertiesParameter =
    blockFunction.params.length === 1 &&
    onlyParameter !== undefined &&
    onlyParameter.type === "Identifier" &&
    onlyParameter.name === PROPS_PARAMETER_NAME &&
    parameterTypeName === blockFile.propsTypeName;

  return isPropertiesParameter ? [] : [{data: {}, messageId: "propsParameter"}];
};

export const buildingBlockRule: Rule.RuleModule = {
  create(context) {
    const blockFile = findBlockFile(context.physicalFilename);
    if (blockFile === undefined) return {};

    return {
      Program(program: {readonly body: readonly unknown[]}) {
        const statements = program.body.filter((statement) => isTopLevelNode(statement));
        const blockReports = [
          ...findExportReports(statements, blockFile),
          ...findSecondBlockReports(statements, blockFile),
          ...findExtraDeclarationReports(statements, blockFile),
          ...findPropertiesReports(statements, blockFile)
        ];
        for (const blockReport of blockReports) {
          context.report({
            data: {
              ...blockReport.data,
              expectedName: blockFile.expectedName,
              fileName: blockFile.fileName,
              propsTypeName: blockFile.propsTypeName,
              role: blockFile.roleTitle,
              stem: blockFile.stem
            },
            loc: {column: 0, line: 1},
            messageId: blockReport.messageId
          });
        }
      }
    };
  },
  meta: {
    docs: {description: "Hold one building block in each file, with its Props type and nothing else."},
    messages: {
      defaultExport:
        "`{{fileName}}` has a default export. A {{role}} is exported by name, `export const {{expectedName}}`, so it " +
        "has one name everywhere it is imported. Export it by that name instead.",
      exportedType:
        "`{{name}}` is a type exported from the {{role}} `{{fileName}}`. A block's file exports the block alone: its " +
        "`{{propsTypeName}}` stays unexported, since a caller passes the props without naming their type, and every " +
        "other type lives in `{{stem}}.type.ts` beside it. Stop exporting it, or move it there.",
      extraDeclaration:
        "`{{name}}` sits in the {{role}} `{{fileName}}`, which holds only `{{expectedName}}` and its " +
        "`{{propsTypeName}}`, so the block reads at a glance and its helpers are found by their role. Move it to " +
        "`{{suggestion}}` beside this file.",
      extraExport:
        "`{{name}}` is a second export of the {{role}} `{{fileName}}`, which exports `{{expectedName}}` alone. One " +
        "building block a file lets each move on its own, and Fast Refresh keeps state only in files that export " +
        "components alone. Move `{{name}}` into a file of its own role.",
      missingBlock:
        "`{{fileName}}` is a {{role}} file but doesn't export `{{expectedName}}`. Its name promises that one block, " +
        "so a reader finds the block from the file and the file from the block. Export `{{expectedName}}`, or rename " +
        "the file after what it holds.",
      propsParameter:
        "`{{expectedName}}` should take its input as one parameter, `props: {{propsTypeName}}`, declared above it in " +
        "this file, and read it as `props.<key>`: every block then has one input with one name, and each value shows " +
        "where it comes from. Give it that parameter, or none if it needs no input.",
      secondBlock:
        "`{{name}}` is a second {{role}} in `{{fileName}}`. One building block a file lets each move on its own when " +
        "it is promoted. Give it its own file, `{{suggestion}}`, beside this one, or in its kind's folder once there " +
        "are two.",
      wrongName:
        "`{{actualName}}` should be `{{expectedName}}`: a {{role}}'s name is its file's name, so `{{fileName}}` " +
        "holds `{{expectedName}}` and each is found from the other. Rename the export, or the file to match it."
    },
    schema: [],
    type: "suggestion"
  }
};

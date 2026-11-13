import {AGGREGOR_PLUGIN} from "@pkg/eslint/src/rules/aggregor.plugin.ts";
import {Linter} from "eslint";
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import tsEslint from "typescript-eslint";
import {afterAll, describe, expect, it} from "vitest";

import type {Config} from "eslint/config";

// The folder-structure rules on a small front end on disk, since they read the files around the one they lint.

const APP_FILES: Readonly<Record<string, string>> = {
  "main.tsx": 'import {Sessions} from "@/modules/sessions/sessions.tsx";\n',
  "modules/other/other.tsx":
    'import {useSessions} from "@/modules/sessions/sessions.hook.ts";\n\nexport const Other = () => useSessions();\n',
  "modules/sessions/components/sessionRow.tsx": "export const SessionRow = () => null;\n",
  "modules/sessions/extra.hook.ts": "export const useExtra = () => 1;\n",
  "modules/sessions/helpers.ts": "export const formatTitle = () => 1;\n",
  "modules/sessions/only.type.ts": "export interface OnlyShape {\n  readonly name: string;\n}\n",
  "modules/sessions/sessions.hook.ts": "export const useSessions = () => null;\n",
  "modules/sessions/sessions.tsx": [
    'import {SessionRow} from "@/modules/sessions/components/sessionRow.tsx";',
    'import {useExtra} from "@/modules/sessions/extra.hook.ts";',
    'import {formatTitle} from "@/modules/sessions/helpers.ts";',
    'import {SessionsList} from "@/modules/sessions/sessionsList/sessionsList.tsx";',
    'import {describeShape} from "@/modules/sessions/sessions.utils.ts";',
    "",
    "export const Wrong = () => [SessionRow, useExtra, formatTitle, describeShape, SessionsList];",
    ""
  ].join("\n"),
  "modules/sessions/sessions.utils.ts": [
    'import type {OnlyShape} from "@/modules/sessions/only.type.ts";',
    "",
    "export const describeShape = (shape: OnlyShape) => shape.name;",
    ""
  ].join("\n"),
  "modules/sessions/sessionsList/sessionsList.tsx": [
    'import type {ListShape} from "@/modules/sessions/sessionsList/sessionsList.type.ts";',
    "",
    "const LIST_LIMIT = 3;",
    "",
    "export const SessionsList = (listShape: ListShape) => [listShape, LIST_LIMIT];",
    ""
  ].join("\n"),
  "modules/sessions/sessionsList/sessionsList.type.ts": "export interface ListShape {\n  readonly name: string;\n}\n"
};

const RULE_NAMES = [
  "building-block",
  "file-role",
  "kind-folder",
  "module-boundary",
  "no-pass-through",
  "single-consumer",
  "stem-folder"
];

const appFolderPath = mkdtempSync(join(tmpdir(), "folderStructure-"));
const sourceRootPath = join(appFolderPath, "src");
for (const [relativePath, fileText] of Object.entries(APP_FILES)) {
  mkdirSync(dirname(join(sourceRootPath, relativePath)), {recursive: true});
  writeFileSync(join(sourceRootPath, relativePath), fileText);
}

const lintConfig: Config = {
  files: ["**/*.{ts,tsx}"],
  languageOptions: {parser: tsEslint.parser},
  plugins: {aggregor: AGGREGOR_PLUGIN},
  rules: Object.fromEntries(RULE_NAMES.map((ruleName) => [`aggregor/${ruleName}`, "error"]))
};

const listMessageIds = (relativePath: string) => {
  const fileText = APP_FILES[relativePath];
  if (fileText === undefined) throw new Error(`${relativePath} isn't one of the app's files.`);

  return new Linter({cwd: appFolderPath})
    .verify(fileText, lintConfig, {filename: join(sourceRootPath, relativePath)})
    .map((lintMessage) => `${String(lintMessage.ruleId)}:${String(lintMessage.messageId)}`);
};

afterAll(() => {
  rmSync(appFolderPath, {force: true, recursive: true});
});

describe("folder-structure rules on names and blocks", () => {
  it("leave the app's entry alone", () => {
    expect(listMessageIds("main.tsx")).toEqual([]);
  });

  it("name a component after its file", () => {
    expect(listMessageIds("modules/sessions/sessions.tsx")).toEqual(["aggregor/building-block:wrongName"]);
  });

  it("want a role on a .ts file", () => {
    expect(listMessageIds("modules/sessions/helpers.ts")).toContain("aggregor/file-role:missingRole");
  });
});

describe("folder-structure rules on folders and consumers", () => {
  it("gather two of a kind in the kind's folder", () => {
    expect(listMessageIds("modules/sessions/extra.hook.ts")).toContain("aggregor/kind-folder:twoOfAKind");
  });

  it("flatten a kind's folder with one entry", () => {
    expect(listMessageIds("modules/sessions/components/sessionRow.tsx")).toContain(
      "aggregor/kind-folder:lonelyKindFolder"
    );
  });

  it("keep a type one file uses in that file", () => {
    expect(listMessageIds("modules/sessions/only.type.ts")).toContain("aggregor/single-consumer:typeSingleConsumer");
  });

  it("keep a block's file to the block and its Props type", () => {
    expect(listMessageIds("modules/sessions/sessionsList/sessionsList.tsx")).toEqual([
      "aggregor/building-block:extraDeclaration",
      "aggregor/building-block:propsParameter"
    ]);
  });

  it("let a block's only types sit in a .type.ts", () => {
    expect(listMessageIds("modules/sessions/sessionsList/sessionsList.type.ts")).toEqual([]);
  });

  it("keep modules apart", () => {
    expect(listMessageIds("modules/other/other.tsx")).toContain("aggregor/module-boundary:crossModuleImport");
  });
});

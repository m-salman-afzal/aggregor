import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";

import {RuleTester} from "oxlint/plugins-dev";
import {afterAll, describe, it} from "vitest";

import {buildingBlockRule} from "@pkg/lint/src/rules/buildingBlock.rule.ts";
import {fileRoleRule} from "@pkg/lint/src/rules/fileRole.rule.ts";
import {kindFolderRule} from "@pkg/lint/src/rules/kindFolder.rule.ts";
import {moduleBoundaryRule} from "@pkg/lint/src/rules/moduleBoundary.rule.ts";
import {noPassThroughRule} from "@pkg/lint/src/rules/noPassThrough.rule.ts";
import {singleConsumerRule} from "@pkg/lint/src/rules/singleConsumer.rule.ts";
import {stemFolderRule} from "@pkg/lint/src/rules/stemFolder.rule.ts";

import type {Rule} from "@oxlint/plugins";

interface FileExpectation {
  readonly behaviour: string;
  readonly messageIdsByRule: Readonly<Record<string, readonly string[]>>;
}

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

const RULES: Readonly<Record<string, Rule>> = {
  "building-block": buildingBlockRule,
  "file-role": fileRoleRule,
  "kind-folder": kindFolderRule,
  "module-boundary": moduleBoundaryRule,
  "no-pass-through": noPassThroughRule,
  "single-consumer": singleConsumerRule,
  "stem-folder": stemFolderRule
};

const FILE_EXPECTATIONS: Readonly<Record<string, FileExpectation>> = {
  "main.tsx": {behaviour: "leave the app's entry alone", messageIdsByRule: {}},
  "modules/other/other.tsx": {
    behaviour: "keep modules apart",
    messageIdsByRule: {"module-boundary": ["crossModuleImport"], "single-consumer": ["unused"]}
  },
  "modules/sessions/components/sessionRow.tsx": {
    behaviour: "flatten a kind's folder with one entry",
    messageIdsByRule: {"kind-folder": ["lonelyKindFolder"]}
  },
  "modules/sessions/extra.hook.ts": {
    behaviour: "gather two of a kind in the kind's folder",
    messageIdsByRule: {"kind-folder": ["twoOfAKind"]}
  },
  "modules/sessions/helpers.ts": {
    behaviour: "want a role on a .ts file",
    messageIdsByRule: {"file-role": ["missingRole"]}
  },
  "modules/sessions/only.type.ts": {
    behaviour: "keep a type one file uses in that file",
    messageIdsByRule: {"single-consumer": ["typeSingleConsumer"]}
  },
  "modules/sessions/sessions.tsx": {
    behaviour: "name a component after its file",
    messageIdsByRule: {"building-block": ["wrongName"]}
  },
  "modules/sessions/sessionsList/sessionsList.tsx": {
    behaviour: "keep a block's file to the block and its Props type",
    messageIdsByRule: {"building-block": ["extraDeclaration", "propsParameter"]}
  },
  "modules/sessions/sessionsList/sessionsList.type.ts": {
    behaviour: "let a block's only types sit in a .type.ts",
    messageIdsByRule: {}
  }
};

const appFolderPath = mkdtempSync(join(tmpdir(), "folderStructure-"));
for (const [relativePath, fileText] of Object.entries(APP_FILES)) {
  mkdirSync(dirname(join(appFolderPath, "src", relativePath)), {recursive: true});
  writeFileSync(join(appFolderPath, "src", relativePath), fileText);
}

const readAppFile = (relativePath: string) => {
  const fileText = APP_FILES[relativePath];
  if (fileText === undefined) throw new Error(`${relativePath} isn't one of the app's files.`);

  return fileText;
};

const listFileCases = () =>
  Object.entries(FILE_EXPECTATIONS).map(([relativePath, fileExpectation]) => ({
    fileExpectation,
    testCase: {
      code: readAppFile(relativePath),
      filename: join("src", relativePath),
      name: `${fileExpectation.behaviour}: ${relativePath}`
    }
  }));

const makeTestCases = (ruleName: string) => {
  const fileCases = listFileCases();

  return {
    invalid: fileCases.flatMap((fileCase) => {
      const messageIds = fileCase.fileExpectation.messageIdsByRule[ruleName];

      return messageIds === undefined
        ? []
        : [{...fileCase.testCase, errors: messageIds.map((messageId) => ({messageId}))}];
    }),
    valid: fileCases
      .filter((fileCase) => fileCase.fileExpectation.messageIdsByRule[ruleName] === undefined)
      .map((fileCase) => fileCase.testCase)
  };
};

RuleTester.describe = (text, method) => {
  describe(text, method);
};
RuleTester.it = it;

afterAll(() => {
  rmSync(appFolderPath, {force: true, recursive: true});
});

describe("folder-structure rules", () => {
  const ruleTester = new RuleTester({cwd: appFolderPath});
  for (const [ruleName, rule] of Object.entries(RULES)) ruleTester.run(ruleName, rule, makeTestCases(ruleName));
});

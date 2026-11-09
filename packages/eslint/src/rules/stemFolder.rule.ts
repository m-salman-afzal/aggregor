import {readdirSync} from "node:fs";
import {basename, dirname, join, relative, sep} from "node:path";

import type {Rule} from "eslint";

// aggregor/stem-folder: files that share their first dotted part (sessions.view.ts, sessions.view.type.ts) sit in a
// folder of that name.
const SOURCE_ROOT = "apps/extension/src";

// The folder this file belongs in, when it isn't there already.
const getExpectedStemFolder = (filePath: string, sourceRootPath: string) => {
  const [stem] = basename(filePath).split(".");
  if (stem === undefined) return undefined;
  const folderPath = dirname(filePath);
  if (basename(folderPath) === stem) return undefined;
  const stemSiblings = readdirSync(folderPath, {withFileTypes: true}).filter(
    (entry) => entry.isFile() && entry.name.split(".")[0] === stem
  );

  if (stemSiblings.length < 2) return undefined;

  return `${relative(sourceRootPath, folderPath).split(sep).join("/")}/${stem}/`;
};

export const stemFolderRule: Rule.RuleModule = {
  create(context) {
    const expectedFolder = getExpectedStemFolder(context.physicalFilename, join(context.cwd, SOURCE_ROOT));

    return {
      Program() {
        if (expectedFolder === undefined) return;
        context.report({data: {expectedFolder}, loc: {column: 0, line: 1}, messageId: "notInStemFolder"});
      }
    };
  },
  meta: {
    docs: {description: "Group files that share their first dotted part in a folder of that name."},
    messages: {
      notInStemFolder:
        "Move this file into {{expectedFolder}}: files sharing their first dotted part sit in a folder of that name."
    },
    schema: [],
    type: "suggestion"
  }
};

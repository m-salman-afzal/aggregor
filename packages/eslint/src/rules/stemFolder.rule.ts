import {readdirSync} from "node:fs";
import {basename, dirname, relative, sep} from "node:path";

import type {Rule} from "eslint";

const getExpectedStemFolder = (filePath: string, repositoryRootPath: string) => {
  const [stem] = basename(filePath).split(".");
  if (stem === undefined) return undefined;
  const folderPath = dirname(filePath);
  if (basename(folderPath) === stem) return undefined;
  const stemSiblings = readdirSync(folderPath, {withFileTypes: true}).filter(
    (entry) => entry.isFile() && entry.name.split(".")[0] === stem
  );

  if (stemSiblings.length < 2) return undefined;

  return `${relative(repositoryRootPath, folderPath).split(sep).join("/")}/${stem}/`;
};

export const stemFolderRule: Rule.RuleModule = {
  create(context) {
    const expectedFolder = getExpectedStemFolder(context.physicalFilename, context.cwd);

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
        "Another file in this folder shares this file's first dotted part, so they belong to one unit. A unit's files " +
        "share a folder named after it, so the unit moves or goes in one piece and its files are found together. " +
        "Move them into {{expectedFolder}}."
    },
    schema: [],
    type: "suggestion"
  }
};

import {existsSync} from "node:fs";
import {basename, dirname, join} from "node:path";

import type {Rule} from "eslint";

const COMPANION_ROLES = new Set(["type"]);

const getDeclaringFileNames = (fileName: string) => {
  const parts = fileName.split(".");
  const role = parts.at(-2);
  if (parts.length < 3 || parts.at(-1) !== "ts" || role === undefined || !COMPANION_ROLES.has(role)) return [];
  const stem = parts.slice(0, -2).join(".");

  return [`${stem}.ts`, `${stem}.interface.ts`];
};

export const declaringFileRule: Rule.RuleModule = {
  create(context) {
    const filePath = context.physicalFilename;
    const declaringFileNames = getDeclaringFileNames(basename(filePath));

    return {
      Program() {
        if (declaringFileNames.length === 0) return;
        const folderPath = dirname(filePath);
        if (declaringFileNames.some((declaringFileName) => existsSync(join(folderPath, declaringFileName)))) return;
        context.report({
          data: {declaringFileNames: declaringFileNames.join(" or ")},
          loc: {column: 0, line: 1},
          messageId: "notBesideDeclaringFile"
        });
      }
    };
  },
  meta: {
    docs: {description: "Keep each .type.ts file beside the file that declares it."},
    messages: {
      notBesideDeclaringFile:
        "Move this file beside the file that declares it: no {{declaringFileNames}} in this folder."
    },
    schema: [],
    type: "problem"
  }
};

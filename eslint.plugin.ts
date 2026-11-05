import {existsSync, readdirSync} from "node:fs";
import {basename, dirname, join, relative, sep} from "node:path";

import type {Rule} from "eslint";
import type {Config} from "eslint/config";

// The extension's own lint rules: span names, where type files sit, and which files share a folder.

// aggregor/span-name: a span is "<owner>.<const>", the owner coming from the file name, so a trace line names the code
// that ran and finds it with one search.

// The file roles that own their spans, with the suffix the owner's name takes: session.repository.ts is
// SessionRepository's, harnessInfraServices.layer.ts is HarnessInfraServices'.
const OWNER_ROLE_SUFFIXES = new Map([
  ["config", "Config"],
  ["controller", "Controller"],
  ["infraService", "InfraService"],
  ["layer", ""],
  ["middleware", "Middleware"],
  ["repository", "Repository"],
  ["service", "Service"],
  ["view", "View"]
]);

const EFFECT_FUNCTION_CALL =
  "CallExpression[callee.type='MemberExpression'][callee.object.name='Effect'][callee.property.name='fn']";

const getOwnerOfFileName = (fileName: string) => {
  const [stem, role, extension, ...rest] = fileName.split(".");
  if (stem === undefined || role === undefined || extension !== "ts" || rest.length > 0) return undefined;
  const suffix = OWNER_ROLE_SUFFIXES.get(role);

  return suffix === undefined ? undefined : `${stem.charAt(0).toUpperCase()}${stem.slice(1)}${suffix}`;
};

// A helper file (status.utils.ts, sessions.utils.ts) belongs to the one owner in its folder, and to none when its
// folder has no owner or several. Read each time, since an editor's ESLint server outlives folder changes.
const getOwnerOfFile = (filePath: string) => {
  const fileOwner = getOwnerOfFileName(basename(filePath));
  if (fileOwner !== undefined) return fileOwner;
  const folderOwners = readdirSync(dirname(filePath)).flatMap((fileName) => {
    const owner = getOwnerOfFileName(fileName);

    return owner === undefined ? [] : [owner];
  });

  return folderOwners.length === 1 ? folderOwners[0] : undefined;
};

// A layer's make function is <owner>.make; every other function keeps its const's name.
const getExpectedSpanName = (owner: string | undefined, constName: string) => {
  if (owner === undefined) return constName;

  return `${owner}.${constName === `make${owner}` ? "make" : constName}`;
};

const describeOwner = (owner: string | undefined) =>
  owner === undefined ? "its file belongs to no owner" : `${owner} owns its file`;

// Effect.fn("name")(function* ...) sits inside the call that applies it; the const holds that outer call.
const getAssignedConstName = (effectFunctionCall: Rule.Node) => {
  const {parent} = effectFunctionCall;
  if (parent === null) return undefined;
  const holder = parent.type === "CallExpression" && parent.callee === effectFunctionCall ? parent.parent : parent;
  if (holder.type !== "VariableDeclarator" || holder.id.type !== "Identifier") return undefined;

  return holder.id.name;
};

const checkSpanName = (context: Rule.RuleContext, owner: string | undefined, effectFunctionCall: Rule.Node) => {
  if (effectFunctionCall.type !== "CallExpression") return;
  const constName = getAssignedConstName(effectFunctionCall);
  if (constName === undefined) {
    context.report({messageId: "notAssigned", node: effectFunctionCall});

    return;
  }
  const [nameArgument] = effectFunctionCall.arguments;
  if (nameArgument === undefined || nameArgument.type !== "Literal" || typeof nameArgument.value !== "string") {
    context.report({messageId: "notLiteral", node: effectFunctionCall});

    return;
  }
  const expectedName = getExpectedSpanName(owner, constName);
  if (nameArgument.value === expectedName) return;
  context.report({
    data: {expectedName, ownerReason: describeOwner(owner)},
    fix: (fixer) => fixer.replaceText(nameArgument, JSON.stringify(expectedName)),
    messageId: "wrongName",
    node: nameArgument
  });
};

const spanNameRule: Rule.RuleModule = {
  create(context) {
    const owner = getOwnerOfFile(context.physicalFilename);

    return {
      [EFFECT_FUNCTION_CALL](effectFunctionCall: Rule.Node) {
        checkSpanName(context, owner, effectFunctionCall);
      }
    };
  },
  meta: {
    docs: {description: "Name each Effect.fn span after its file's owner and the const it is assigned to."},
    fixable: "code",
    messages: {
      notAssigned: "Assign this Effect.fn to a const, so its span can be named after it.",
      notLiteral: "Name this span with a string literal, so a trace line finds its function with one search.",
      wrongName: 'Name this span "{{expectedName}}": {{ownerReason}}, and the span takes the name of its const.'
    },
    schema: [],
    type: "suggestion"
  }
};

// aggregor/declaring-file: X.type.ts sits beside the file that declares it, X.ts or X.interface.ts, so the interface or
// implementation its types belong to is the file next to it.
const COMPANION_ROLES = new Set(["type"]);

const getDeclaringFileNames = (fileName: string) => {
  const parts = fileName.split(".");
  const role = parts.at(-2);
  if (parts.length < 3 || parts.at(-1) !== "ts" || role === undefined || !COMPANION_ROLES.has(role)) return [];
  const stem = parts.slice(0, -2).join(".");

  return [`${stem}.ts`, `${stem}.interface.ts`];
};

const declaringFileRule: Rule.RuleModule = {
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

const stemFolderRule: Rule.RuleModule = {
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

export const PLUGIN_CONFIG: Config = {
  files: ["apps/extension/src/**/*.ts"],
  plugins: {
    aggregor: {rules: {"declaring-file": declaringFileRule, "span-name": spanNameRule, "stem-folder": stemFolderRule}}
  },
  rules: {"aggregor/declaring-file": "error", "aggregor/span-name": "error", "aggregor/stem-folder": "error"}
};

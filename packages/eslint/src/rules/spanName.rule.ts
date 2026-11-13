import {readdirSync} from "node:fs";
import {basename, dirname} from "node:path";

import type {Rule} from "eslint";

// session.repository.ts is SessionRepository's, agentInfraServices.layer.ts is AgentInfraServices'.
const OWNER_ROLE_SUFFIXES = new Map([
  ["config", "Config"],
  ["controller", "Controller"],
  ["domainService", "DomainService"],
  ["infraService", "InfraService"],
  ["layer", ""],
  ["middleware", "Middleware"],
  ["presenter", "Presenter"],
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

// Read each time, since an editor's ESLint server outlives folder changes.
const getOwnerOfFile = (filePath: string) => {
  const fileOwner = getOwnerOfFileName(basename(filePath));
  if (fileOwner !== undefined) return fileOwner;
  const folderOwners = readdirSync(dirname(filePath)).flatMap((fileName) => {
    const owner = getOwnerOfFileName(fileName);

    return owner === undefined ? [] : [owner];
  });

  return folderOwners.length === 1 ? folderOwners[0] : undefined;
};

const getExpectedSpanName = (owner: string | undefined, constName: string) => {
  if (owner === undefined) return constName;

  return `${owner}.${constName === `make${owner}` ? "make" : constName}`;
};

const describeOwner = (owner: string | undefined) =>
  owner === undefined ? "its file belongs to no owner" : `${owner} owns its file`;

// Effect.fn("name")(function* ...) sits inside the call that applies it; the const holds that outer call.
const getAssignedConstName = (effectFunctionCall: Rule.Node) => {
  if (effectFunctionCall.parent === null) return undefined;
  const holder =
    effectFunctionCall.parent.type === "CallExpression" && effectFunctionCall.parent.callee === effectFunctionCall
      ? effectFunctionCall.parent.parent
      : effectFunctionCall.parent;
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

export const spanNameRule: Rule.RuleModule = {
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

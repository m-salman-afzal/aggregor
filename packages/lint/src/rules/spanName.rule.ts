import {basename} from "node:path";

import {EFFECT_FUNCTION_CALL, isServiceMakeProperty} from "@pkg/lint/src/rules/effectFunction.utils.ts";

import type {Context, ESTree, Rule} from "@oxlint/plugins";

const OWNER_ROLE_SUFFIXES = new Map([
  ["config", "Config"],
  ["controller", "Controller"],
  ["domainService", "DomainService"],
  ["errorMessage", "ErrorMessage"],
  ["infraService", "InfraService"],
  ["layer", ""],
  ["middleware", "Middleware"],
  ["repository", "Repository"],
  ["service", "Service"],
  ["transformer", "Transformer"],
  ["utils", "Utils"],
  ["view", "View"]
]);

const SERVICE_CLASS =
  "ClassDeclaration[superClass.callee.callee.object.name='Context'][superClass.callee.callee.property.name='Service']";
const MAKE_FUNCTION_NAME = "make";

const getOwnerOfFile = (filePath: string) => {
  const [stem, role, extension, ...rest] = basename(filePath).split(".");
  if (stem === undefined || role === undefined || extension !== "ts" || rest.length > 0) return undefined;
  const suffix = OWNER_ROLE_SUFFIXES.get(role);

  return suffix === undefined ? undefined : `${stem.charAt(0).toUpperCase()}${stem.slice(1)}${suffix}`;
};

// Effect.fn("name")(function* ...) sits inside the call that applies it; the const or make property holds that call.
const getAppliedCall = (effectFunctionCall: ESTree.Node) => {
  const applyingCall = effectFunctionCall.parent;

  return applyingCall !== null && applyingCall.type === "CallExpression" && applyingCall.callee === effectFunctionCall
    ? applyingCall
    : effectFunctionCall;
};

const getAssignedConstName = (appliedCall: ESTree.Node) => {
  const holder = appliedCall.parent;
  if (holder === null || holder.type !== "VariableDeclarator" || holder.id.type !== "Identifier") return undefined;

  return holder.id.name;
};

const findOwnerClassName = (effectFunctionCall: ESTree.Node) => {
  for (let ancestor = effectFunctionCall.parent; ancestor !== null; ancestor = ancestor.parent) {
    if (ancestor.type === "ClassDeclaration") return ancestor.id === null ? undefined : ancestor.id.name;
  }

  return undefined;
};

const findExpectedSpanName = (effectFunctionCall: ESTree.Node) => {
  const appliedCall = getAppliedCall(effectFunctionCall);
  const functionName = isServiceMakeProperty(appliedCall) ? MAKE_FUNCTION_NAME : getAssignedConstName(appliedCall);
  if (functionName === undefined) return undefined;
  const ownerClassName = findOwnerClassName(effectFunctionCall);

  return ownerClassName === undefined ? functionName : `${ownerClassName}.${functionName}`;
};

const checkSpanName = (context: Context, effectFunctionCall: ESTree.Node) => {
  if (effectFunctionCall.type !== "CallExpression") return;
  const expectedName = findExpectedSpanName(effectFunctionCall);
  if (expectedName === undefined) {
    context.report({messageId: "notAssigned", node: effectFunctionCall});

    return;
  }
  const [nameArgument] = effectFunctionCall.arguments;
  if (nameArgument === undefined || nameArgument.type !== "Literal" || typeof nameArgument.value !== "string") {
    context.report({messageId: "notLiteral", node: effectFunctionCall});

    return;
  }
  if (nameArgument.value === expectedName) return;
  context.report({
    data: {expectedName},
    fix: (fixer) => fixer.replaceText(nameArgument, JSON.stringify(expectedName)),
    messageId: "wrongName",
    node: nameArgument
  });
};

const checkOwnerClassName = (context: Context, owner: string | undefined, serviceClass: ESTree.Node) => {
  if (serviceClass.type !== "ClassDeclaration" || serviceClass.id === null) return;
  if (owner === undefined || serviceClass.id.name === owner) return;
  context.report({data: {owner}, messageId: "wrongClassName", node: serviceClass.id});
};

export const spanNameRule: Rule = {
  create(context) {
    const owner = getOwnerOfFile(context.physicalFilename);

    return {
      [EFFECT_FUNCTION_CALL](effectFunctionCall: ESTree.Node) {
        checkSpanName(context, effectFunctionCall);
      },
      [SERVICE_CLASS](serviceClass: ESTree.Node) {
        checkOwnerClassName(context, owner, serviceClass);
      }
    };
  },
  meta: {
    docs: {
      description:
        "Name every Effect.fn span <its class>.<its const>, a Context.Service's make <its class>.make, and a unit's " +
        "class after its file."
    },
    fixable: "code",
    messages: {
      notAssigned:
        "Assign this Effect.fn to a const, or make it a Context.Service's make, so its span can be named after it and " +
        "a trace line finds its function with one search.",
      notLiteral: "Name this span with a string literal, so a trace line finds its function with one search.",
      wrongClassName:
        'Name this class "{{owner}}": a unit is named after its file, and its name stands before every span it ' +
        "makes, so a trace line says which file it ran in.",
      wrongName:
        'Name this span "{{expectedName}}": a span carries its class and then its const, or make for the class\'s ' +
        "make, so a trace line says which unit ran and finds its function with one search. `pnpm lint:fix` writes it."
    },
    schema: [],
    type: "suggestion"
  }
};

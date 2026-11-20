import {EFFECT_FUNCTION_CALL, isServiceMakeProperty} from "@pkg/eslint/src/rules/effectFunction.utils.ts";
import {basename} from "node:path";

import type {Rule} from "eslint";

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

const OWN_SPANS_CALL = "CallExpression[callee.type='Identifier'][callee.name='ownSpans']";
const MAKE_REASON = "a Context.Service's make is named make, and ownSpans prints its unit's name before it";
const CONST_REASON = "a function inside a make takes its const's name, and ownSpans prints its unit's name before it";

const getOwnerOfFile = (filePath: string) => {
  const [stem, role, extension, ...rest] = basename(filePath).split(".");
  if (stem === undefined || role === undefined || extension !== "ts" || rest.length > 0) return undefined;
  const suffix = OWNER_ROLE_SUFFIXES.get(role);

  return suffix === undefined ? undefined : `${stem.charAt(0).toUpperCase()}${stem.slice(1)}${suffix}`;
};

// Effect.fn("name")(function* ...) sits inside the call that applies it; the const or make property holds that call.
const getAppliedCall = (effectFunctionCall: Rule.Node) => {
  const applyingCall = effectFunctionCall.parent;

  return applyingCall !== null && applyingCall.type === "CallExpression" && applyingCall.callee === effectFunctionCall
    ? applyingCall
    : effectFunctionCall;
};

const getAssignedConstName = (appliedCall: Rule.Node) => {
  const holder = appliedCall.parent;
  if (holder === null || holder.type !== "VariableDeclarator" || holder.id.type !== "Identifier") return undefined;

  return holder.id.name;
};

const findExpectedSpanName = (effectFunctionCall: Rule.Node) => {
  const appliedCall = getAppliedCall(effectFunctionCall);
  if (isServiceMakeProperty(appliedCall)) return {expectedName: "make", reason: MAKE_REASON};
  const constName = getAssignedConstName(appliedCall);

  return constName === undefined ? undefined : {expectedName: constName, reason: CONST_REASON};
};

const checkSpanName = (context: Rule.RuleContext, effectFunctionCall: Rule.Node) => {
  if (effectFunctionCall.type !== "CallExpression") return;
  const expectedSpanName = findExpectedSpanName(effectFunctionCall);
  if (expectedSpanName === undefined) {
    context.report({messageId: "notAssigned", node: effectFunctionCall});

    return;
  }
  const [nameArgument] = effectFunctionCall.arguments;
  if (nameArgument === undefined || nameArgument.type !== "Literal" || typeof nameArgument.value !== "string") {
    context.report({messageId: "notLiteral", node: effectFunctionCall});

    return;
  }
  if (nameArgument.value === expectedSpanName.expectedName) return;
  context.report({
    data: expectedSpanName,
    fix: (fixer) => fixer.replaceText(nameArgument, JSON.stringify(expectedSpanName.expectedName)),
    messageId: "wrongName",
    node: nameArgument
  });
};

const checkOwnSpansName = (context: Rule.RuleContext, owner: string | undefined, ownSpansCall: Rule.Node) => {
  if (ownSpansCall.type !== "CallExpression" || owner === undefined) return;
  const [nameArgument] = ownSpansCall.arguments;
  if (nameArgument === undefined || (nameArgument.type === "Literal" && nameArgument.value === owner)) return;
  context.report({
    data: {owner},
    fix: (fixer) => fixer.replaceText(nameArgument, JSON.stringify(owner)),
    messageId: "wrongOwnSpansName",
    node: nameArgument
  });
};

export const spanNameRule: Rule.RuleModule = {
  create(context) {
    const owner = getOwnerOfFile(context.physicalFilename);

    return {
      [EFFECT_FUNCTION_CALL](effectFunctionCall: Rule.Node) {
        checkSpanName(context, effectFunctionCall);
      },
      [OWN_SPANS_CALL](ownSpansCall: Rule.Node) {
        checkOwnSpansName(context, owner, ownSpansCall);
      }
    };
  },
  meta: {
    docs: {
      description:
        "Name a Context.Service's make span make and every other Effect.fn span after its const, and pass ownSpans " +
        "its file's owner."
    },
    fixable: "code",
    messages: {
      notAssigned:
        "Assign this Effect.fn to a const, or make it a Context.Service's make, so its span can be named after it and " +
        "a trace line finds its function with one search.",
      notLiteral: "Name this span with a string literal, so a trace line finds its function with one search.",
      wrongName: 'Name this span "{{expectedName}}": {{reason}}, so a trace line finds its function with one search.',
      wrongOwnSpansName:
        'Pass "{{owner}}" to ownSpans: {{owner}} owns this file, and the trace log prints this name before every span ' +
        "of the unit, so a trace line says which unit it ran in."
    },
    schema: [],
    type: "suggestion"
  }
};

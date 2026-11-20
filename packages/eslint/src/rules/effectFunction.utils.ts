import type {Rule} from "eslint";

type SyntaxNode = Parameters<Rule.RuleContext["sourceCode"]["getAncestors"]>[0];

export const EFFECT_FUNCTION_CALL =
  "CallExpression[callee.type='MemberExpression'][callee.object.name='Effect'][callee.property.name='fn']";

const MAKE_CONST_NAME = /^make[A-Z]/u;

const isMemberCall = (node: SyntaxNode, objectName: string, propertyName: string) =>
  node.type === "CallExpression" &&
  node.callee.type === "MemberExpression" &&
  node.callee.object.type === "Identifier" &&
  node.callee.object.name === objectName &&
  node.callee.property.type === "Identifier" &&
  node.callee.property.name === propertyName;

const isFunction = (node: Rule.Node) =>
  node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression" || node.type === "FunctionDeclaration";

export const listFunctionAncestors = (node: Rule.Node) => {
  const functionAncestors: Rule.Node[] = [];
  for (let ancestor = node.parent; ancestor !== null; ancestor = ancestor.parent) {
    if (isFunction(ancestor)) functionAncestors.push(ancestor);
  }

  return functionAncestors;
};

// Effect.fn("name")(function* ...): the body is the first argument of the call that applies Effect.fn.
const isEffectFunctionBody = (functionNode: Rule.Node) => {
  const appliedCall = functionNode.parent;
  if (appliedCall === null || appliedCall.type !== "CallExpression") return false;

  return appliedCall.arguments[0] === functionNode && isMemberCall(appliedCall.callee, "Effect", "fn");
};

// Context.Service<Unit>()("key", {make: Effect.fn("make")(...)}).
export const isServiceMakeProperty = (appliedCall: Rule.Node) => {
  const property = appliedCall.parent;
  if (property === null || property.type !== "Property" || property.value !== appliedCall) return false;
  if (property.key.type !== "Identifier" || property.key.name !== "make") return false;
  const serviceCall = property.parent.parent;

  return (
    serviceCall !== null &&
    serviceCall.type === "CallExpression" &&
    isMemberCall(serviceCall.callee, "Context", "Service")
  );
};

// A make<Name> const builds what a unit hands out, such as a base class's makeFor.
const isMakeConst = (appliedCall: Rule.Node) => {
  const declarator = appliedCall.parent;
  if (declarator === null || declarator.type !== "VariableDeclarator" || declarator.init !== appliedCall) return false;

  return declarator.id.type === "Identifier" && MAKE_CONST_NAME.test(declarator.id.name);
};

export const isMakeBody = (functionNode: Rule.Node) =>
  functionNode.parent !== null &&
  isEffectFunctionBody(functionNode) &&
  (isServiceMakeProperty(functionNode.parent) || isMakeConst(functionNode.parent));

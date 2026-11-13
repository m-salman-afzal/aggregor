import {parseFileName} from "@pkg/eslint/src/folderStructure/folderStructure.utils.ts";
import {basename} from "node:path";

import type {Rule} from "eslint";

// aggregor/constant-placement: a constant lives in @pkg/constants, in its feature's <feature>.constant.ts, grouped in an
// object with the constants it belongs with. A module-level const named in UPPER_CASE, or set to a bare literal, is one.
// In a front end (the "constantFile" option) it lives in its unit's <name>.constant.ts, or in @pkg/constants when the
// extension shares it.

// What the rule reads of a declared value; typescript-eslint's `as const` and `satisfies` nodes aren't in ESLint's types.
interface DeclaredValue {
  readonly type: string;
}

const UPPER_CASE_NAME = /^[A-Z][\dA-Z]*(?:_[\dA-Z]+)+$|^[A-Z]{2,}$/u;
const VALUE_WRAPPER_TYPES = new Set(["TSAsExpression", "TSSatisfiesExpression"]);

const isDeclaredValue = (value: unknown): value is DeclaredValue =>
  typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";

// `as const` and `satisfies` wrap a value without changing what it is.
const unwrapValue = (declaredValue: DeclaredValue): DeclaredValue => {
  if (!VALUE_WRAPPER_TYPES.has(declaredValue.type) || !("expression" in declaredValue)) return declaredValue;

  return isDeclaredValue(declaredValue.expression) ? unwrapValue(declaredValue.expression) : declaredValue;
};

const isBareLiteral = (declaredValue: DeclaredValue) =>
  declaredValue.type === "Literal" ||
  (declaredValue.type === "TemplateLiteral" &&
    "expressions" in declaredValue &&
    Array.isArray(declaredValue.expressions) &&
    declaredValue.expressions.length === 0);

export const constantPlacementRule: Rule.RuleModule = {
  create(context) {
    const isFrontEnd = context.options[0] === "constantFile";
    const stem = parseFileName(basename(context.physicalFilename)).stem;
    const checkDeclarator = (declarator: Rule.Node) => {
      if (declarator.type !== "VariableDeclarator" || declarator.id.type !== "Identifier") return;
      const isLiteralValue = isDeclaredValue(declarator.init) && isBareLiteral(unwrapValue(declarator.init));
      if (!UPPER_CASE_NAME.test(declarator.id.name) && !isLiteralValue) return;
      const messageId = isFrontEnd ? "outsideConstantFile" : "outsideConstants";

      context.report({data: {constantName: declarator.id.name, stem}, messageId, node: declarator.id});
    };

    return {
      "Program > ExportNamedDeclaration > VariableDeclaration[kind='const'] > VariableDeclarator": checkDeclarator,
      "Program > VariableDeclaration[kind='const'] > VariableDeclarator": checkDeclarator
    };
  },
  meta: {
    docs: {description: "Keep constants in @pkg/constants, grouped by feature."},
    messages: {
      outsideConstantFile:
        "{{constantName}} is a constant outside a constants file. A unit's constants sit in its <name>.constant.ts, " +
        "so they are found in one place and change without touching code. Move it into `{{stem}}.constant.ts` beside " +
        "this file, or into @pkg/constants when the extension uses it too.",
      outsideConstants:
        "{{constantName}} is a constant outside @pkg/constants. Every constant lives in its feature's " +
        "<feature>.constant.ts there, inside an object with the constants it belongs with, so the texts and ids a " +
        "feature uses sit in one place. Move it there."
    },
    schema: [{enum: ["constantFile", "package"]}],
    type: "suggestion"
  }
};

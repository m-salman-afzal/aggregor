import type {Context, ESTree, Rule} from "@oxlint/plugins";

const SCROLLING_CLASS_PATTERN = /(?:^|[\s:"'`])overflow(?:-[xy])?-(?:auto|scroll)(?=[\s"'`]|$)/u;
const MINIMAL_SCROLLBAR_CLASS_PATTERN = /(?:^|[\s:"'`])scrollbar-minimal(?=[\s"'`]|$)/u;
const CLASS_LIST_PARENT_TYPES = new Set([
  "ArrayExpression",
  "BinaryExpression",
  "CallExpression",
  "ConditionalExpression",
  "LogicalExpression",
  "TemplateLiteral"
]);

// A class list can be split across `+`, `cn(...)` or a template, so the whole expression around the string counts.
const findClassListRoot = (node: ESTree.Node): ESTree.Node =>
  node.parent !== null && CLASS_LIST_PARENT_TYPES.has(node.parent.type) ? findClassListRoot(node.parent) : node;

const checkClassText = (context: Context, node: ESTree.Node, classText: string) => {
  if (!SCROLLING_CLASS_PATTERN.test(classText)) return;
  const classListText = context.sourceCode.getText(findClassListRoot(node));
  if (!MINIMAL_SCROLLBAR_CLASS_PATTERN.test(classListText))
    context.report({messageId: "missingMinimalScrollbar", node});
};

export const minimalScrollbarRule: Rule = {
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value === "string") checkClassText(context, node, node.value);
      },
      TemplateElement(node) {
        checkClassText(context, node, node.value.raw);
      }
    };
  },
  meta: {
    docs: {description: "Give every scrolling element the theme's minimal scrollbar."},
    messages: {
      missingMinimalScrollbar:
        "This class list scrolls (overflow-*-auto or overflow-*-scroll) without `scrollbar-minimal`. VS Code gives every " +
        "webview its own thick scrollbar, and the Sessions view's scrollbars are thin pills shown only while the pointer " +
        "is in what they scroll. Add `scrollbar-minimal` (`@pkg/ui`'s theme.css) to the same class list."
    },
    schema: [],
    type: "problem"
  }
};

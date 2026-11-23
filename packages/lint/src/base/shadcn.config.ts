import {SHADCN_COMPONENT_FILES} from "@pkg/lint/src/base/ignores.config.ts";

import type {OxlintOverride} from "oxlint";

const ARROW_SHADCN_COMPONENT_MESSAGE =
  "A @pkg/ui component is an arrow function, `const Button = ({className, ...props}: ButtonProps) => …`, never a " +
  "`function`: shadcn's CLI writes `function` declarations, and every other component in @pkg/ui and the webview is " +
  "an arrow, so the design system reads in one shape. Rewrite what `shadcn add` wrote as arrow functions.";

export const SHADCN_OVERRIDES: OxlintOverride[] = [
  {
    files: [SHADCN_COMPONENT_FILES],
    rules: {
      "eslint-js/no-restricted-syntax": [
        "error",
        {message: ARROW_SHADCN_COMPONENT_MESSAGE, selector: ":matches(FunctionDeclaration, FunctionExpression)"}
      ]
    }
  }
];

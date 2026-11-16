import {SHADCN_COMPONENT_FILES} from "@pkg/eslint/src/base/ignores.config.ts";
import {defineConfig} from "eslint/config";
import tsEslint from "typescript-eslint";

import type {Config} from "eslint/config";

const ARROW_SHADCN_COMPONENT_MESSAGE =
  "A @pkg/ui component is an arrow function, `const Button = ({className, ...props}: ButtonProps) => …`, never a " +
  "`function`: shadcn's CLI writes `function` declarations, and every other component in @pkg/ui and the webview is " +
  "an arrow, so the design system reads in one shape. Rewrite what `shadcn add` wrote as arrow functions.";

export const SHADCN_CONFIGS: Config[] = defineConfig([
  {
    files: [SHADCN_COMPONENT_FILES],
    languageOptions: {parser: tsEslint.parser},
    rules: {
      "no-restricted-syntax": [
        "error",
        {message: ARROW_SHADCN_COMPONENT_MESSAGE, selector: ":matches(FunctionDeclaration, FunctionExpression)"}
      ]
    }
  }
]);

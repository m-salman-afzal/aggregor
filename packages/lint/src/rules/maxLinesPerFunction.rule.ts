import eslintJsPlugin from "oxlint-plugin-eslint";

import {EFFECT_FUNCTION_CALL, isMakeBody, listFunctionAncestors} from "@pkg/lint/src/rules/effectFunction.utils.ts";

import type {Context, Diagnostic, ESTree, Rule} from "@oxlint/plugins";

const CORE_RULE = eslintJsPlugin.rules["max-lines-per-function"];
if (CORE_RULE === undefined || CORE_RULE.create === undefined)
  throw new Error("oxlint-plugin-eslint no longer ships max-lines-per-function.");
const createCoreRule = CORE_RULE.create;

// The core rule reports on entering a function, before its nested Effect.fns are seen, so reports wait for the file's end.
export const maxLinesPerFunctionRule: Rule = {
  create(context) {
    const coreReports: Diagnostic[] = [];
    const makeBodiesHoldingEffectFunctions = new Set<unknown>();
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- oxlint locks a context, so a child shadows its report
    const coreContext: Context = Object.create(context, {
      report: {value: (coreReport: Diagnostic) => coreReports.push(coreReport)}
    });

    return {
      ...createCoreRule(coreContext),
      [EFFECT_FUNCTION_CALL](effectFunctionCall: ESTree.Node) {
        for (const functionAncestor of listFunctionAncestors(effectFunctionCall))
          if (isMakeBody(functionAncestor)) makeBodiesHoldingEffectFunctions.add(functionAncestor);
      },
      "Program:exit"() {
        for (const coreReport of coreReports)
          if (coreReport.node === undefined || !makeBodiesHoldingEffectFunctions.has(coreReport.node))
            context.report({...coreReport, messageId: "tooLong"});
      }
    };
  },
  meta: {
    docs: {description: "Cap each function's length, except a make that only holds its unit's functions."},
    messages: {
      tooLong:
        "{{name}} has {{lineCount}} lines, over the limit of {{maxLines}}. Each function has one job, so each shows up " +
        "as its own span in the trace: split it into smaller functions. A Context.Service's make, or a make<Name> " +
        "const such as BaseRepository's makeForTable, is exempt when it holds Effect.fns, since it only gathers them; every " +
        "function inside it stays capped."
    },
    schema: CORE_RULE.meta === undefined || CORE_RULE.meta.schema === undefined ? [] : CORE_RULE.meta.schema,
    type: "suggestion"
  }
};

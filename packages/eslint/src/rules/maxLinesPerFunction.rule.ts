import {EFFECT_FUNCTION_CALL, isMakeBody, listFunctionAncestors} from "@pkg/eslint/src/rules/effectFunction.utils.ts";
import {builtinRules} from "eslint/use-at-your-own-risk";

import type {Rule} from "eslint";

// eslint-disable-next-line @typescript-eslint/no-deprecated -- ESLint has no other way to reach a core rule to compose
const CORE_RULE = builtinRules.get("max-lines-per-function");
if (CORE_RULE === undefined) throw new Error("ESLint no longer ships max-lines-per-function.");

// The core rule reports on entering a function, before its nested Effect.fns are seen, so reports wait for the file's end.
export const maxLinesPerFunctionRule: Rule.RuleModule = {
  create(context) {
    const coreReports: Rule.ReportDescriptor[] = [];
    const makeBodiesHoldingEffectFunctions = new Set<unknown>();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- ESLint freezes a context, so a child shadows its report
    const coreContext: Rule.RuleContext = Object.create(context, {
      report: {value: (coreReport: Rule.ReportDescriptor) => coreReports.push(coreReport)}
    });

    return {
      ...CORE_RULE.create(coreContext),
      [EFFECT_FUNCTION_CALL](effectFunctionCall: Rule.Node) {
        for (const functionAncestor of listFunctionAncestors(effectFunctionCall))
          if (isMakeBody(functionAncestor)) makeBodiesHoldingEffectFunctions.add(functionAncestor);
      },
      "Program:exit"() {
        for (const coreReport of coreReports)
          if (!("node" in coreReport) || !makeBodiesHoldingEffectFunctions.has(coreReport.node))
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
    schema: CORE_RULE.meta === undefined ? [] : CORE_RULE.meta.schema,
    type: "suggestion"
  }
};

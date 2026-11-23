import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";

type TypescriptEslintRule = NonNullable<(typeof typescriptEslintPlugin.rules)[string]>;

type TypescriptEslintRuleContext = Parameters<TypescriptEslintRule["create"]>[0];

const UNTYPED_PARSER_SERVICES = {
  esTreeNodeToTSNodeMap: new WeakMap(),
  program: null,
  tsNodeToESTreeNodeMap: new WeakMap()
};

// typescript-eslint asks for parser services up front even when its options need no types, and oxlint gives none.
const makeContextWithoutTypes = (ruleContext: TypescriptEslintRuleContext): TypescriptEslintRuleContext => {
  const sourceCodeWithoutTypes: unknown = Object.setPrototypeOf(
    {parserServices: UNTYPED_PARSER_SERVICES},
    ruleContext.sourceCode
  );

  // oxlint-disable-next-line typescript/no-unsafe-return -- the context's own prototype keeps every other member typed
  return Object.setPrototypeOf({sourceCode: sourceCodeWithoutTypes}, ruleContext);
};

const makeRuleWithoutTypes = (ruleName: string): TypescriptEslintRule => {
  const typescriptEslintRule = typescriptEslintPlugin.rules[ruleName];
  if (typescriptEslintRule === undefined) throw new Error(`typescript-eslint has no rule named ${ruleName}`);

  return {
    ...typescriptEslintRule,
    create: (ruleContext: TypescriptEslintRuleContext) =>
      typescriptEslintRule.create(makeContextWithoutTypes(ruleContext))
  };
};

const typescriptEslintRulesPlugin: {
  readonly meta: {readonly name: string};
  readonly rules: Readonly<Record<string, TypescriptEslintRule>>;
} = {
  meta: {name: "typescript-js"},
  rules: {
    "member-ordering": makeRuleWithoutTypes("member-ordering"),
    "naming-convention": makeRuleWithoutTypes("naming-convention"),
    "no-restricted-imports": makeRuleWithoutTypes("no-restricted-imports")
  }
};

export default typescriptEslintRulesPlugin;

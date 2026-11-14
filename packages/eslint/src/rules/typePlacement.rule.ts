import type {Rule, Scope} from "eslint";

type LintedSourceCode = Rule.RuleContext["sourceCode"];
type SyntaxNode = Parameters<LintedSourceCode["getAncestors"]>[0];

interface TypePlacementFacts {
  readonly firstValueStart: number | undefined;
  readonly sources: ReadonlyMap<string, number> | undefined;
}

interface TypeSourceEntry {
  readonly isTypeSource: boolean;
  readonly referringStatement: SyntaxNode;
  readonly sourceName: string;
  readonly sourceStatement: SyntaxNode;
}

const VALUE_DEFINITION_TYPES = new Set(["ClassName", "FunctionName", "Variable"]);
const TYPE_DEFINITION_TYPE = "Type";
const TYPE_DECLARATION_TYPES = new Set(["TSInterfaceDeclaration", "TSTypeAliasDeclaration"]);
const VALUE_STATEMENT_TYPES = new Set([
  "ClassDeclaration",
  "ExportDefaultDeclaration",
  "ExpressionStatement",
  "FunctionDeclaration",
  "VariableDeclaration"
]);

const getDeclaredNodeType = (statement: SyntaxNode): string =>
  statement.type === "ExportNamedDeclaration" && statement.declaration !== null && statement.declaration !== undefined
    ? statement.declaration.type
    : statement.type;

const getTopLevelStatement = (sourceCode: LintedSourceCode, node: SyntaxNode) => {
  const [, topLevelStatement] = sourceCode.getAncestors(node);

  return topLevelStatement === undefined ? node : topLevelStatement;
};

const getStatementStart = (statement: SyntaxNode) => (statement.range === undefined ? 0 : statement.range[0]);

const findTypeSourceEntries = (sourceCode: LintedSourceCode, variable: Scope.Variable): TypeSourceEntry[] => {
  const [definition] = variable.defs;
  if (definition === undefined) return [];
  // typescript-eslint's scope analysis adds the "Type" definition, which ESLint's types don't list.
  const definitionType: string = definition.type;
  const isTypeSource = definitionType === TYPE_DEFINITION_TYPE;
  if (!isTypeSource && !VALUE_DEFINITION_TYPES.has(definitionType)) return [];
  const sourceStatement = getTopLevelStatement(sourceCode, definition.node);

  return variable.references.flatMap((reference) => {
    if (reference.identifier.type !== "Identifier") return [];
    const referringStatement = getTopLevelStatement(sourceCode, reference.identifier);
    const isFromAnotherType =
      referringStatement !== sourceStatement && TYPE_DECLARATION_TYPES.has(getDeclaredNodeType(referringStatement));

    return isFromAnotherType ? [{isTypeSource, referringStatement, sourceName: variable.name, sourceStatement}] : [];
  });
};

const findBuiltTypeStatements = (typeSourceEntries: readonly TypeSourceEntry[]) => {
  const builtTypeStatements = new Set(
    typeSourceEntries
      .filter((typeSourceEntry) => !typeSourceEntry.isTypeSource)
      .map((typeSourceEntry) => typeSourceEntry.referringStatement)
  );
  const isNewlyBuilt = (typeSourceEntry: TypeSourceEntry) =>
    typeSourceEntry.isTypeSource &&
    builtTypeStatements.has(typeSourceEntry.sourceStatement) &&
    !builtTypeStatements.has(typeSourceEntry.referringStatement);
  for (
    let newlyBuiltEntries = typeSourceEntries.filter(isNewlyBuilt);
    newlyBuiltEntries.length > 0;
    newlyBuiltEntries = typeSourceEntries.filter(isNewlyBuilt)
  ) {
    for (const newlyBuiltEntry of newlyBuiltEntries) builtTypeStatements.add(newlyBuiltEntry.referringStatement);
  }

  return builtTypeStatements;
};

const findTypeSources = (sourceCode: LintedSourceCode, topLevelVariables: readonly Scope.Variable[]) => {
  const typeSourceEntries = topLevelVariables.flatMap((variable) => findTypeSourceEntries(sourceCode, variable));
  const builtTypeStatements = findBuiltTypeStatements(typeSourceEntries);
  const typeSources = new Map<SyntaxNode, Map<string, number>>();
  const buildingEntries = typeSourceEntries.filter(
    (typeSourceEntry) => !typeSourceEntry.isTypeSource || builtTypeStatements.has(typeSourceEntry.sourceStatement)
  );
  for (const buildingEntry of buildingEntries) {
    const knownSources = typeSources.get(buildingEntry.referringStatement);
    const sources = knownSources === undefined ? new Map<string, number>() : knownSources;
    sources.set(buildingEntry.sourceName, getStatementStart(buildingEntry.sourceStatement));
    typeSources.set(buildingEntry.referringStatement, sources);
  }

  return typeSources;
};

const reportMisplacedType = (
  context: Rule.RuleContext,
  typeStatement: SyntaxNode,
  typePlacementFacts: TypePlacementFacts
) => {
  const typeStart = getStatementStart(typeStatement);
  if (typePlacementFacts.sources === undefined) {
    if (typePlacementFacts.firstValueStart !== undefined && typePlacementFacts.firstValueStart < typeStart)
      context.report({messageId: "standaloneTypeBelowValues", node: typeStatement});

    return;
  }
  for (const [sourceName, sourceStart] of typePlacementFacts.sources) {
    if (sourceStart > typeStart)
      context.report({data: {sourceName}, messageId: "typeAboveSource", node: typeStatement});
  }
};

export const typePlacementRule: Rule.RuleModule = {
  create(context) {
    return {
      "Program:exit"() {
        const globalScope = context.sourceCode.scopeManager.globalScope;
        if (globalScope === null) return;
        const topLevelStatements = context.sourceCode.ast.body;
        const typeSources = findTypeSources(
          context.sourceCode,
          [globalScope, ...globalScope.childScopes].flatMap((scope) => scope.variables)
        );
        const firstValueStatement = topLevelStatements.find((statement) =>
          VALUE_STATEMENT_TYPES.has(getDeclaredNodeType(statement))
        );
        const firstValueStart = firstValueStatement === undefined ? undefined : getStatementStart(firstValueStatement);
        for (const statement of topLevelStatements) {
          if (TYPE_DECLARATION_TYPES.has(getDeclaredNodeType(statement)))
            reportMisplacedType(context, statement, {firstValueStart, sources: typeSources.get(statement)});
        }
      }
    };
  },
  meta: {
    docs: {description: "Keep standalone types at the top of the file, and types built from its values below them."},
    messages: {
      standaloneTypeBelowValues: "Declare types and interfaces at the top of the file, after the imports.",
      typeAboveSource: "Move this type below {{sourceName}}, which it is built from."
    },
    schema: [],
    type: "suggestion"
  }
};

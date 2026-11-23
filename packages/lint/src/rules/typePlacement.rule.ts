import type {Context, ESTree, Rule, Variable} from "@oxlint/plugins";

interface TypePlacementFacts {
  readonly firstValueStart: number | undefined;
  readonly sources: ReadonlyMap<string, number> | undefined;
}

interface TypeSourceEntry {
  readonly isTypeSource: boolean;
  readonly referringStatement: ESTree.Node;
  readonly sourceName: string;
  readonly sourceStatement: ESTree.Node;
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

const getDeclaredNodeType = (statement: ESTree.Node): string =>
  statement.type === "ExportNamedDeclaration" && statement.declaration !== null
    ? statement.declaration.type
    : statement.type;

const getTopLevelStatement = (node: ESTree.Node): ESTree.Node =>
  node.parent === null || node.parent.type === "Program" ? node : getTopLevelStatement(node.parent);

const getStatementStart = (statement: ESTree.Node) => statement.range[0];

const findTypeSourceEntries = (variable: Variable): TypeSourceEntry[] => {
  const [definition] = variable.defs;
  if (definition === undefined) return [];
  // typescript-eslint's scope analysis adds the "Type" definition, which ESLint's types don't list.
  const definitionType: string = definition.type;
  const isTypeSource = definitionType === TYPE_DEFINITION_TYPE;
  if (!isTypeSource && !VALUE_DEFINITION_TYPES.has(definitionType)) return [];
  const sourceStatement = getTopLevelStatement(definition.node);

  return variable.references.flatMap((reference) => {
    const referringStatement = getTopLevelStatement(reference.identifier);
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

const findTypeSources = (topLevelVariables: readonly Variable[]) => {
  const typeSourceEntries = topLevelVariables.flatMap((variable) => findTypeSourceEntries(variable));
  const builtTypeStatements = findBuiltTypeStatements(typeSourceEntries);
  const typeSources = new Map<ESTree.Node, Map<string, number>>();
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

const reportMisplacedType = (context: Context, typeStatement: ESTree.Node, typePlacementFacts: TypePlacementFacts) => {
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

export const typePlacementRule: Rule = {
  create(context) {
    return {
      "Program:exit"() {
        const globalScope = context.sourceCode.scopeManager.globalScope;
        if (globalScope === null) return;
        const topLevelStatements = context.sourceCode.ast.body;
        const typeSources = findTypeSources(
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

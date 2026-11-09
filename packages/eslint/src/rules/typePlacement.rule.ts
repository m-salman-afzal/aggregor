import type {Rule, Scope} from "eslint";

// What aggregor/type-placement reads: the linted file and its syntax nodes.
type LintedSourceCode = Rule.RuleContext["sourceCode"];
type SyntaxNode = Parameters<LintedSourceCode["getAncestors"]>[0];

// What decides where a type belongs: the values of its file it is built from, or else the file's first value.
interface TypePlacementFacts {
  readonly firstValueStart: number | undefined;
  readonly sources: ReadonlyMap<string, number> | undefined;
}

// A reference from a top-level type to a value or type of its own file.
interface TypeSourceEntry {
  readonly isTypeSource: boolean;
  readonly referringStatement: SyntaxNode;
  readonly sourceName: string;
  readonly sourceStatement: SyntaxNode;
}

// aggregor/type-placement: a type that stands alone sits at the top of the file, after the imports; a type built from a
// value in its own file (`typeof AgentListItemDtoSchema.Type`, a union of the file's errors), directly or through
// another such type, sits below what it is built from, so the file reads top down.

// The definitions a type can be built from in its own file: a const, a class or a function, or another type built from
// one. Imports sit above anyway.
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

// An exported declaration counts as what it exports.
const getDeclaredNodeType = (statement: SyntaxNode): string =>
  statement.type === "ExportNamedDeclaration" && statement.declaration !== null && statement.declaration !== undefined
    ? statement.declaration.type
    : statement.type;

// The statement directly under Program that holds the node.
const getTopLevelStatement = (sourceCode: LintedSourceCode, node: SyntaxNode) => {
  const [, topLevelStatement] = sourceCode.getAncestors(node);

  return topLevelStatement === undefined ? node : topLevelStatement;
};

const getStatementStart = (statement: SyntaxNode) => (statement.range === undefined ? 0 : statement.range[0]);

// Each reference from a top-level type to this value or type, with the statement that declares it.
const findTypeSourceEntries = (sourceCode: LintedSourceCode, variable: Scope.Variable): TypeSourceEntry[] => {
  const [definition] = variable.defs;
  if (definition === undefined) return [];
  // typescript-eslint's scope analysis adds the "Type" definition, which ESLint's types don't list.
  const definitionType: string = definition.type;
  const isTypeSource = definitionType === TYPE_DEFINITION_TYPE;
  if (!isTypeSource && !VALUE_DEFINITION_TYPES.has(definitionType)) return [];
  const sourceStatement = getTopLevelStatement(sourceCode, definition.node);

  return variable.references.flatMap(({identifier}) => {
    if (identifier.type !== "Identifier") return [];
    const referringStatement = getTopLevelStatement(sourceCode, identifier);
    const isFromAnotherType =
      referringStatement !== sourceStatement && TYPE_DECLARATION_TYPES.has(getDeclaredNodeType(referringStatement));

    return isFromAnotherType ? [{isTypeSource, referringStatement, sourceName: variable.name, sourceStatement}] : [];
  });
};

// The types built from the file's values, directly or through another such type.
const findBuiltTypeStatements = (typeSourceEntries: readonly TypeSourceEntry[]) => {
  const builtTypeStatements = new Set(
    typeSourceEntries.filter(({isTypeSource}) => !isTypeSource).map(({referringStatement}) => referringStatement)
  );
  const isNewlyBuilt = ({isTypeSource, referringStatement, sourceStatement}: TypeSourceEntry) =>
    isTypeSource && builtTypeStatements.has(sourceStatement) && !builtTypeStatements.has(referringStatement);
  for (
    let newlyBuiltEntries = typeSourceEntries.filter(isNewlyBuilt);
    newlyBuiltEntries.length > 0;
    newlyBuiltEntries = typeSourceEntries.filter(isNewlyBuilt)
  ) {
    for (const {referringStatement} of newlyBuiltEntries) builtTypeStatements.add(referringStatement);
  }

  return builtTypeStatements;
};

// Each top-level type built from the file's values, with what it is built from and where each is declared.
const findTypeSources = (sourceCode: LintedSourceCode, topLevelVariables: readonly Scope.Variable[]) => {
  const typeSourceEntries = topLevelVariables.flatMap((variable) => findTypeSourceEntries(sourceCode, variable));
  const builtTypeStatements = findBuiltTypeStatements(typeSourceEntries);
  const typeSources = new Map<SyntaxNode, Map<string, number>>();
  const buildingEntries = typeSourceEntries.filter(
    ({isTypeSource, sourceStatement}) => !isTypeSource || builtTypeStatements.has(sourceStatement)
  );
  for (const {referringStatement, sourceName, sourceStatement} of buildingEntries) {
    const knownSources = typeSources.get(referringStatement);
    const sources = knownSources === undefined ? new Map<string, number>() : knownSources;
    sources.set(sourceName, getStatementStart(sourceStatement));
    typeSources.set(referringStatement, sources);
  }

  return typeSources;
};

const reportMisplacedType = (
  context: Rule.RuleContext,
  typeStatement: SyntaxNode,
  {firstValueStart, sources}: TypePlacementFacts
) => {
  const typeStart = getStatementStart(typeStatement);
  if (sources === undefined) {
    if (firstValueStart !== undefined && firstValueStart < typeStart)
      context.report({messageId: "standaloneTypeBelowValues", node: typeStatement});

    return;
  }
  for (const [sourceName, sourceStart] of sources) {
    if (sourceStart > typeStart)
      context.report({data: {sourceName}, messageId: "typeAboveSource", node: typeStatement});
  }
};

export const typePlacementRule: Rule.RuleModule = {
  create(context) {
    const {sourceCode} = context;

    return {
      "Program:exit"() {
        const {globalScope} = sourceCode.scopeManager;
        if (globalScope === null) return;
        const topLevelStatements = sourceCode.ast.body;
        const typeSources = findTypeSources(
          sourceCode,
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

import type {ESTree, Rule, Scope} from "@oxlint/plugins";

const findImportSource = (scope: Scope, localName: string) => {
  const variable = scope.set.get(localName);
  const importDefinition =
    variable === undefined ? undefined : variable.defs.find((definition) => definition.type === "ImportBinding");
  const importDeclaration = importDefinition === undefined ? null : importDefinition.parent;
  if (importDeclaration === null || importDeclaration.type !== "ImportDeclaration") return undefined;

  return importDeclaration.source.value;
};

export const noPassThroughRule: Rule = {
  create(context) {
    const reportPassThrough = (node: ESTree.Node, name: string, source: string) => {
      context.report({data: {name, source}, messageId: "passThrough", node});
    };

    return {
      ExportAllDeclaration(node) {
        reportPassThrough(node, "everything", node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source !== null) {
          reportPassThrough(node, "its names", node.source.value);

          return;
        }
        const scope = context.sourceCode.getScope(node);
        const importedNames = node.specifiers.flatMap((specifier) => {
          const importSource =
            specifier.local.type === "Identifier" ? findImportSource(scope, specifier.local.name) : undefined;

          return specifier.local.type === "Identifier" && importSource !== undefined
            ? [{importSource, name: specifier.local.name}]
            : [];
        });
        for (const importedName of importedNames)
          reportPassThrough(node, `\`${importedName.name}\``, importedName.importSource);
      }
    };
  },
  meta: {
    docs: {description: "Import each symbol from the file that declares it, never through a re-export."},
    messages: {
      passThrough:
        "This file re-exports {{name}} from `{{source}}`. A pass-through hides where code lives and lingers as a dead " +
        "alias after a move. Import from `{{source}}` wherever it is used, and delete this export."
    },
    schema: [],
    type: "suggestion"
  }
};

import type {Rule, Scope} from "eslint";

// aggregor/no-pass-through: no file re-exports what another file declares (the folder-structure skill's "No
// pass-through re-exports"); each consumer imports a symbol from where it lives.

// The module an imported name came from, as the import names it.
const findImportSource = (scope: Scope.Scope, localName: string) => {
  const variable = scope.set.get(localName);
  const importDefinition =
    variable === undefined ? undefined : variable.defs.find((definition) => definition.type === "ImportBinding");
  const importDeclaration = importDefinition === undefined ? null : importDefinition.parent;
  if (importDeclaration === null) return undefined;

  return typeof importDeclaration.source.value === "string" ? importDeclaration.source.value : undefined;
};

export const noPassThroughRule: Rule.RuleModule = {
  create(context) {
    const reportPassThrough = (node: Rule.Node, name: string, source: string) => {
      context.report({data: {name, source}, messageId: "passThrough", node});
    };

    return {
      ExportAllDeclaration(node) {
        reportPassThrough(node, "everything", String(node.source.value));
      },
      ExportNamedDeclaration(node) {
        if (node.source !== null && node.source !== undefined) {
          reportPassThrough(node, "its names", String(node.source.value));

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

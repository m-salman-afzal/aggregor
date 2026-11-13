import {CORE_MODULE, findSourceRoot, MODULES_FOLDER} from "@pkg/eslint/src/folderStructure/folderStructure.utils.ts";
import {dirname, relative, sep} from "node:path";

import type {Rule} from "eslint";

// aggregor/module-boundary: a feature module imports from itself, its parent modules, core and packages only, and core
// imports no feature module, so deleting a module's folder breaks nothing but the file that mounts it (the
// folder-structure skill's "Imports between modules" and its delete test).

const APP_ALIAS = "@/";

// The modules a path sits in, outermost first: src/modules/sessions/modules/archive/... is sessions, then archive.
const listModuleNames = (pathParts: readonly string[]) =>
  pathParts.flatMap((pathPart, partIndex) => {
    const moduleName = pathParts[partIndex + 1];

    return pathPart === MODULES_FOLDER && moduleName !== undefined ? [moduleName] : [];
  });

const isWithinModules = (importedModuleNames: readonly string[], fileModuleNames: readonly string[]) =>
  importedModuleNames.every((moduleName, moduleIndex) => fileModuleNames[moduleIndex] === moduleName);

export const moduleBoundaryRule: Rule.RuleModule = {
  create(context) {
    const filePath = context.physicalFilename;
    const sourceRootPath = findSourceRoot(filePath);
    if (sourceRootPath === undefined) return {};
    const fileModuleNames = listModuleNames(relative(sourceRootPath, dirname(filePath)).split(sep));
    const [fileTopModule] = fileModuleNames;

    const checkSource = (sourceNode: Rule.Node) => {
      if (sourceNode.type !== "Literal" || typeof sourceNode.value !== "string") return;
      const source = sourceNode.value;
      if (!source.startsWith(APP_ALIAS) || fileTopModule === undefined) return;
      const importedModuleNames = listModuleNames(source.slice(APP_ALIAS.length).split("/"));
      const [importedTopModule] = importedModuleNames;
      if (importedTopModule === undefined || importedTopModule === CORE_MODULE) return;
      if (fileTopModule !== CORE_MODULE && isWithinModules(importedModuleNames, fileModuleNames)) return;
      const messageId = fileTopModule === CORE_MODULE ? "coreImportsFeature" : "crossModuleImport";
      const importedModule = importedModuleNames.join("/modules/");
      const fileModule = fileModuleNames.join("/modules/");
      context.report({data: {fileModule, importedModule, source}, messageId, node: sourceNode});
    };

    return {
      "ExportAllDeclaration > Literal.source": checkSource,
      "ExportNamedDeclaration > Literal.source": checkSource,
      "ImportDeclaration > Literal.source": checkSource,
      "ImportExpression > Literal.source": checkSource
    };
  },
  meta: {
    docs: {description: "Keep each front-end module's imports to itself, its parents, core and packages."},
    messages: {
      coreImportsFeature:
        "core imports `{{source}}` from the `{{importedModule}}` feature module. core imports no feature module, so " +
        "no feature comes to depend on another through it and each can be deleted on its own. Move what core needs " +
        "into core, or a package, and import it from there.",
      crossModuleImport:
        "The `{{fileModule}}` module imports `{{source}}` from the `{{importedModule}}` module. A module imports from " +
        "itself, its parent modules, core and packages only, so deleting one breaks nothing else. Move what both " +
        "need up to the level they share (core, a parent module, or a package) and import it from there."
    },
    schema: [],
    type: "problem"
  }
};

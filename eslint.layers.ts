import type {Config} from "eslint/config";

// The DDD layering of apps/extension (see DDD.md): what each layer may import, where types and interfaces live, and
// the names each file's role requires.

const OPTION_IMPORT_BANS = [
  {importNames: ["Option"], message: "Use Result: its error says why a value is missing.", name: "effect"},
  {message: "Use Result: its error says why a value is missing.", name: "effect/Option"}
];

// infrastructure/vscode/vscode.api.ts holds the one runtime import of vscode; everything else yields VsCodeApi.
export const IMPORT_BANS = [
  ...OPTION_IMPORT_BANS,
  {allowTypeImports: true, message: "Import only vscode's types; yield VsCodeApi for its values.", name: "vscode"}
];

// The layers' allow-lists.
const APPLICATION_IMPORTS = {
  message: "The application layer imports only effect, @pkg, and domain or application code.",
  regex: "^(?!effect(/|$)|@pkg/|@/(domain|application)/)"
};

const PRESENTATION_IMPORTS = {
  message:
    "The presentation layer imports only effect, vscode types, @pkg, and domain, application or presentation code; " +
    "from infrastructure, only vscode.api and utils.",
  regex:
    "^(?!effect(/|$)|vscode$|@pkg/|@/(domain|application|presentation)/|@/infrastructure/(vscode/vscode\\.api\\.ts$|utils/))"
};

const INFRASTRUCTURE_IMPORTS = {
  message:
    "The infrastructure layer imports only effect, @effect, vscode, node, @pkg, and domain, application or " +
    "infrastructure code.",
  regex: "^(?!effect(/|$)|@effect/|vscode$|node:|@pkg/|@/(domain|application|infrastructure)/)"
};

export const SYNTAX_BANS = [
  {message: "No optional chaining: check the value explicitly.", selector: "ChainExpression"},
  {
    message: "No ??: check the value explicitly, or take a default with Result.getOrElse or UndefinedOr.match.",
    selector: "LogicalExpression[operator='??']"
  },
  {message: "No ??=: check the value explicitly.", selector: "AssignmentExpression[operator='??=']"},
  {
    message: "Declare types and interfaces at the top of the file, after the imports.",
    selector:
      "Program > :matches(VariableDeclaration, ClassDeclaration, FunctionDeclaration, ExpressionStatement, " +
      "ExportDefaultDeclaration, ExportNamedDeclaration[declaration.type=/^(VariableDeclaration|ClassDeclaration|" +
      "FunctionDeclaration)$/]) ~ :matches(TSTypeAliasDeclaration, TSInterfaceDeclaration, " +
      "ExportNamedDeclaration[declaration.type=/^TS(TypeAlias|Interface)Declaration$/])"
  }
];

// The extension's shared types live in .type.ts files, its interfaces in .interface.ts files.
const EXPORTED_TYPE_BAN = {
  message: "Export types from a .type.ts file; only value objects and error unions stay in their own files.",
  selector: "ExportNamedDeclaration > :matches(TSTypeAliasDeclaration, TSInterfaceDeclaration)"
};
const SERVICE_CLASS_BAN = {
  message: "A Context.Service is an interface: declare it in a .interface.ts file.",
  selector:
    "ClassDeclaration > CallExpression.superClass > CallExpression.callee > MemberExpression[object.name='Context']"
};
const NON_TYPE_BAN = {
  message: "A .type.ts file holds only types.",
  selector:
    "Program > :not(ImportDeclaration, TSTypeAliasDeclaration, TSInterfaceDeclaration, " +
    "ExportNamedDeclaration[declaration.type=/^TS(TypeAlias|Interface)Declaration$/])"
};

// Each file suffix names a role, and the file's main names carry it.
const ROLE_NAMES = {
  "**/*.entity.ts": [{format: ["PascalCase"], selector: "class", suffix: ["Entity"]}],
  "**/*.error.ts": [{format: ["PascalCase"], selector: ["class", "typeAlias"], suffix: ["Error"]}],
  "**/*.infraService.ts": [
    {format: ["PascalCase"], modifiers: ["exported"], selector: "variable", suffix: ["InfraService"]}
  ],
  "**/*.interface.ts": [{format: ["PascalCase"], prefix: ["I"], selector: "class"}],
  "**/*.layer.ts": [{format: ["PascalCase"], modifiers: ["exported"], selector: "variable", suffix: ["Layer"]}],
  "**/*.model.ts": [
    {
      filter: {match: false, regex: "^[A-Z0-9_]+$"},
      format: ["PascalCase"],
      modifiers: ["exported"],
      selector: "variable",
      suffix: ["Model"]
    }
  ],
  "**/*.valueObject.ts": [
    {format: ["PascalCase"], selector: ["typeAlias", "interface"], suffix: ["ValueObject"]},
    {
      filter: {match: true, regex: "^[A-Z]"},
      format: ["PascalCase"],
      modifiers: ["exported"],
      selector: "variable",
      suffix: ["ValueObjectSchema"]
    }
  ],
  "**/*.view.ts": [{format: ["PascalCase"], modifiers: ["exported"], selector: "variable", suffix: ["View"]}],
  "infrastructure/config/*.config.ts": [
    {format: ["PascalCase"], modifiers: ["exported"], selector: "variable", suffix: ["Config"]}
  ],
  "infrastructure/repositories/*.repository.ts": [
    {format: ["PascalCase"], modifiers: ["exported"], selector: "variable", suffix: ["Repository"]}
  ]
};

export const LAYER_CONFIGS: Config[] = [
  {
    files: ["apps/extension/src/domain/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: OPTION_IMPORT_BANS,
          patterns: [
            {
              message: "The domain layer imports only effect and other domain code.",
              regex: "^(?!effect(/|$)|@/domain/)"
            }
          ]
        }
      ]
    }
  },
  {
    files: ["apps/extension/src/application/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {paths: OPTION_IMPORT_BANS, patterns: [APPLICATION_IMPORTS]}
      ]
    }
  },
  {
    files: ["apps/extension/src/presentation/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {paths: IMPORT_BANS, patterns: [PRESENTATION_IMPORTS]}]
    }
  },
  {
    files: ["apps/extension/src/infrastructure/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {paths: IMPORT_BANS, patterns: [INFRASTRUCTURE_IMPORTS]}]
    }
  },
  {
    files: ["apps/extension/src/**/*.ts"],
    ignores: ["**/*.error.ts", "**/*.interface.ts", "**/*.type.ts", "**/*.valueObject.ts", "**/vscode.api.ts"],
    rules: {"no-restricted-syntax": ["error", ...SYNTAX_BANS, EXPORTED_TYPE_BAN, SERVICE_CLASS_BAN]}
  },
  {
    files: ["apps/extension/src/**/*.interface.ts", "apps/extension/src/infrastructure/vscode/vscode.api.ts"],
    rules: {"no-restricted-syntax": ["error", ...SYNTAX_BANS, EXPORTED_TYPE_BAN]}
  },
  {
    files: ["apps/extension/src/**/*.error.ts", "apps/extension/src/**/*.valueObject.ts"],
    rules: {"no-restricted-syntax": ["error", ...SYNTAX_BANS, SERVICE_CLASS_BAN]}
  },
  {
    files: ["apps/extension/src/**/*.type.ts"],
    rules: {"no-restricted-syntax": ["error", ...SYNTAX_BANS, NON_TYPE_BAN]}
  },
  ...Object.entries(ROLE_NAMES).map(([filePattern, namingOptions]): Config => ({
    files: [`apps/extension/src/${filePattern}`],
    rules: {"@typescript-eslint/naming-convention": ["error", ...namingOptions]}
  })),
  {
    files: ["apps/extension/src/infrastructure/vscode/vscode.api.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {paths: OPTION_IMPORT_BANS, patterns: [INFRASTRUCTURE_IMPORTS]}
      ]
    }
  }
];

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

// Each layer's folders, by their tsconfig.json aliases. A layer's code is imported only through these, so each file has
// one import path.
const DOMAIN_ALIASES = "domainServices|entities|valueObjects";
const APPLICATION_ALIASES = "interfaces|services|appUtils";
const INFRASTRUCTURE_ALIASES = "config|models|di|logger|repositories|infraServices|infraUtils|vscodeApi";
const PRESENTATION_ALIASES = "controllers|middlewares|presentationUtils|views";

// The layers' allow-lists.
const DOMAIN_IMPORTS = {
  message: "The domain layer imports only effect and other domain code, through its aliases.",
  regex: `^(?!effect(/|$)|@(${DOMAIN_ALIASES})/)`
};

const APPLICATION_IMPORTS = {
  message: "The application layer imports only effect, @pkg, and domain or application code, through their aliases.",
  regex: `^(?!effect(/|$)|@pkg/|@(${DOMAIN_ALIASES}|${APPLICATION_ALIASES})/)`
};

const PRESENTATION_IMPORTS = {
  message:
    "The presentation layer imports only effect, vscode types, @pkg, and domain, application or presentation code, " +
    "through their aliases; from infrastructure, only vscode.api and utils.",
  regex:
    `^(?!effect(/|$)|vscode$|@pkg/|@(${DOMAIN_ALIASES}|${APPLICATION_ALIASES}|${PRESENTATION_ALIASES})/|` +
    "@vscodeApi/vscode\\.api\\.ts$|@infraUtils/)"
};

const INFRASTRUCTURE_IMPORTS = {
  message:
    "The infrastructure layer imports only effect, @effect, vscode, node, @pkg, and domain, application or " +
    "infrastructure code, through their aliases.",
  regex: `^(?!effect(/|$)|@effect/|vscode$|node:|@pkg/|@(${DOMAIN_ALIASES}|${APPLICATION_ALIASES}|${INFRASTRUCTURE_ALIASES})/)`
};

const TAGGED_ERROR_CLASS =
  "ClassDeclaration[superClass.callee.callee.object.name='Schema'][superClass.callee.callee.property.name='TaggedError']";
const EXPORTED_TAGGED_ERROR_CLASS =
  "ExportNamedDeclaration[declaration.superClass.callee.callee.object.name='Schema']" +
  "[declaration.superClass.callee.callee.property.name='TaggedError']";

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
  },
  // Errors sit at the top of the file that raises them, or of the interface whose signatures name them.
  {
    message: "Declare errors at the top of the file, after the imports and types.",
    selector:
      "Program > :matches(VariableDeclaration, FunctionDeclaration, ExpressionStatement, ExportDefaultDeclaration, " +
      `ClassDeclaration:not(${TAGGED_ERROR_CLASS}), ` +
      "ExportNamedDeclaration[declaration.type=/^(VariableDeclaration|FunctionDeclaration)$/], " +
      `ExportNamedDeclaration[declaration.type='ClassDeclaration']:not(${EXPORTED_TAGGED_ERROR_CLASS})) ~ ` +
      `:matches(${TAGGED_ERROR_CLASS}, ${EXPORTED_TAGGED_ERROR_CLASS})`
  },
  {message: "End an error class's name in Error.", selector: `${TAGGED_ERROR_CLASS}:not([id.name=/Error$/])`},
  {message: "Import by name: list what the file takes from the module.", selector: "ImportNamespaceSpecifier"}
];

// An interface's own types and error unions live in its .interface.ts; types several implementation files share, in a
// .type.ts.
const EXPORTED_TYPE_BAN = {
  message: "Export types from a .type.ts or .interface.ts file; only a value object's type stays in its own file.",
  selector: "ExportNamedDeclaration > :matches(TSTypeAliasDeclaration, TSInterfaceDeclaration)"
};
const SERVICE_CLASS_BAN = {
  message: "A Context.Service is an interface: declare it in a .interface.ts file.",
  selector:
    "ClassDeclaration > CallExpression.superClass > CallExpression.callee > MemberExpression[object.name='Context']"
};
const ERROR_FILE_BAN = {
  message:
    "Declare errors at the top of the file that raises them, or of the interface whose signatures name them; " +
    "there are no .error.ts files.",
  selector: "Program"
};
// An entity file holds its entity, whose own rules are its methods; rules across entities go in a .domainService.ts.
const ENTITY_EXPORT_BAN = {
  message: "Export only the entity class; a rule across entities goes in a .domainService.ts.",
  selector: "ExportNamedDeclaration:not([declaration.type='ClassDeclaration']), ExportDefaultDeclaration"
};
// Every domain service function is an Effect.fn, so each rule shows up in a trace as its own span.
const DOMAIN_SERVICE_EXPORT_BAN = {
  message: "Export each domain service function as an Effect.fn, so it gets its span.",
  selector:
    "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator:not([init.callee.callee.object.name='Effect']" +
    "[init.callee.callee.property.name='fn']), ExportNamedDeclaration > FunctionDeclaration, ExportDefaultDeclaration"
};
// Every function is an Effect.fn, so each call shows up in a trace as its own span; functions nested in one are its
// callbacks.
const PLAIN_FUNCTION_BAN = {
  message: "Declare each function as an Effect.fn, so it gets its span.",
  selector:
    "Program > VariableDeclaration > VariableDeclarator > :function, " +
    "Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > :function, " +
    "Program > FunctionDeclaration, ExportNamedDeclaration > FunctionDeclaration, ExportDefaultDeclaration > :function"
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
  "**/*.infraService.ts": [
    {format: ["PascalCase"], modifiers: ["exported"], selector: "variable", suffix: ["InfraService"]}
  ],
  "**/*.interface.ts": [
    {filter: {match: false, regex: "Error$"}, format: ["PascalCase"], prefix: ["I"], selector: "class"}
  ],
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
          patterns: [DOMAIN_IMPORTS]
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
    ignores: ["**/*.interface.ts", "**/*.type.ts", "**/*.valueObject.ts", "**/vscode.api.ts"],
    rules: {"no-restricted-syntax": ["error", ...SYNTAX_BANS, EXPORTED_TYPE_BAN, SERVICE_CLASS_BAN, PLAIN_FUNCTION_BAN]}
  },
  {
    files: ["apps/extension/src/**/*.entity.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...SYNTAX_BANS,
        EXPORTED_TYPE_BAN,
        SERVICE_CLASS_BAN,
        PLAIN_FUNCTION_BAN,
        ENTITY_EXPORT_BAN
      ]
    }
  },
  {
    files: ["apps/extension/src/**/*.domainService.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...SYNTAX_BANS,
        EXPORTED_TYPE_BAN,
        SERVICE_CLASS_BAN,
        PLAIN_FUNCTION_BAN,
        DOMAIN_SERVICE_EXPORT_BAN
      ]
    }
  },
  {
    files: ["apps/extension/src/**/*.interface.ts"],
    rules: {"no-restricted-syntax": ["error", ...SYNTAX_BANS, PLAIN_FUNCTION_BAN]}
  },
  {
    files: ["apps/extension/src/infrastructure/vscode/vscode.api.ts"],
    rules: {"no-restricted-syntax": ["error", ...SYNTAX_BANS, EXPORTED_TYPE_BAN, PLAIN_FUNCTION_BAN]}
  },
  {
    files: ["apps/extension/src/**/*.valueObject.ts"],
    rules: {"no-restricted-syntax": ["error", ...SYNTAX_BANS, SERVICE_CLASS_BAN, PLAIN_FUNCTION_BAN]}
  },
  {
    files: ["apps/extension/src/**/*.type.ts"],
    rules: {"no-restricted-syntax": ["error", ...SYNTAX_BANS, NON_TYPE_BAN]}
  },
  {files: ["apps/extension/src/**/*.error.ts"], rules: {"no-restricted-syntax": ["error", ERROR_FILE_BAN]}},
  // A file's errors sit at its top, above its other classes.
  {
    files: ["apps/extension/src/**/*.ts"],
    rules: {
      "max-classes-per-file": "off",
      "perfectionist/sort-modules": [
        "error",
        {
          customGroups: [{elementNamePattern: "Error$", groupName: "error-class", selector: "class"}],
          groups: [
            "declare-enum",
            "export-enum",
            "enum",
            ["declare-interface", "declare-type"],
            ["export-interface", "export-type"],
            ["interface", "type"],
            "error-class",
            "declare-class",
            "class",
            "export-class",
            "declare-function",
            "export-function",
            "function"
          ]
        }
      ]
    }
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

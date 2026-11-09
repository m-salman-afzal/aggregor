// What each part of apps/extension may import (see DDD.md): no Option anywhere, vscode's values only through
// VsCodeApi, and per layer an allow-list of its aliases.

export const OPTION_IMPORT_BANS = [
  {importNames: ["Option"], message: "Use Result: its error says why a value is missing.", name: "effect"},
  {message: "Use Result: its error says why a value is missing.", name: "effect/Option"}
];

// packages/vscode/src/vscode.api.ts holds the one runtime import of vscode; everything else yields VsCodeApi.
export const IMPORT_BANS = [
  ...OPTION_IMPORT_BANS,
  {allowTypeImports: true, message: "Import only vscode's types; yield VsCodeApi for its values.", name: "vscode"}
];

// Each layer's folders, by their tsconfig.json aliases. A layer's code is imported only through these, so each file has
// one import path.
const DOMAIN_ALIASES = "domainServices|entities|valueObjects";
const APPLICATION_ALIASES = "interfaces|services|dtos";
const INFRASTRUCTURE_ALIASES = "config|models|di|logger|repositories|infraServices|infraUtils";

// The layers' allow-lists.
const DOMAIN_IMPORTS = {
  message: "The domain layer imports only effect and other domain code, through its aliases.",
  regex: `^(?!effect(/|$)|@(${DOMAIN_ALIASES})/)`
};

const APPLICATION_IMPORTS = {
  message:
    "The application layer imports only effect, @pkg/constants, and domain or application code, through their aliases.",
  regex: `^(?!effect(/|$)|@pkg/constants/|@(${DOMAIN_ALIASES}|${APPLICATION_ALIASES})/)`
};

// Presentation reaches the backend only through controllers, and a controller only through services (see DDD.md): it
// decodes what VS Code passes into a request DTO and calls one service. A presenter turns a service's failure into a
// message, and a view draws what its controllers return. Presentation imports nothing from the domain or
// infrastructure; what it shares with infrastructure lives in @pkg.
const PRESENTATION_IMPORTS = {
  message:
    "Presentation's routes, middlewares and helpers import only effect, vscode types, @pkg, controllers, middlewares, " +
    "presenters and presentation helpers.",
  regex: "^(?!effect(/|$)|vscode$|@pkg/|@(controllers|middlewares|presenters|presentationUtils)/)"
};

const CONTROLLER_IMPORTS = {
  message:
    "A controller imports only effect, services, DTOs, presentation helpers and @pkg/vscode's argument decoding: it " +
    "decodes its input into a request DTO and calls a service.",
  regex: "^(?!effect(/|$)|@(services|dtos|presentationUtils)/|@pkg/vscode/src/vsCodeArgument\\.utils\\.ts$)"
};

const PRESENTER_IMPORTS = {
  message:
    "A presenter imports only effect, @pkg/constants, and services' types, whose failures it turns into messages.",
  regex: "^(?!effect(/|$)|@pkg/constants/|@services/)"
};

const VIEW_IMPORTS = {
  message:
    "A view imports only effect, vscode types, @pkg, controllers, its own files, presentation helpers and DTOs' types.",
  regex: "^(?!effect(/|$)|vscode$|@pkg/|@(controllers|views|presentationUtils|dtos)/)"
};

// Type-only imports: a presenter names its services' failures, a view the DTOs it draws.
const SERVICE_TYPE_IMPORTS = {
  allowTypeImports: true,
  message: "A presenter imports only services' types.",
  regex: "^@services/"
};

const DTO_TYPE_IMPORTS = {
  allowTypeImports: true,
  message: "A view imports only DTOs' types; it gets the DTOs from its controllers.",
  regex: "^@dtos/"
};

const INFRASTRUCTURE_IMPORTS = {
  message:
    "The infrastructure layer imports only effect, @effect, drizzle-orm, vscode types, node, @pkg, and domain, " +
    "application or infrastructure code, through their aliases.",
  regex: `^(?!effect(/|$)|@effect/|drizzle-orm(/|$)|vscode$|node:|@pkg/|@(${DOMAIN_ALIASES}|${APPLICATION_ALIASES}|${INFRASTRUCTURE_ALIASES})/)`
};

// Each folder's import allow-list, by its path under apps/extension/src; a later entry overrides an earlier one.
export const IMPORT_RULES = [
  ["domain", OPTION_IMPORT_BANS, [DOMAIN_IMPORTS]],
  ["application", OPTION_IMPORT_BANS, [APPLICATION_IMPORTS]],
  ["presentation", IMPORT_BANS, [PRESENTATION_IMPORTS]],
  ["presentation/controllers", IMPORT_BANS, [CONTROLLER_IMPORTS]],
  ["presentation/presenters", IMPORT_BANS, [PRESENTER_IMPORTS, SERVICE_TYPE_IMPORTS]],
  ["presentation/views", IMPORT_BANS, [VIEW_IMPORTS, DTO_TYPE_IMPORTS]],
  ["infrastructure", IMPORT_BANS, [INFRASTRUCTURE_IMPORTS]]
] as const;

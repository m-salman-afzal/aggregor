export const OPTION_IMPORT_BANS = [
  {importNames: ["Option"], message: "Use Result: its error says why a value is missing.", name: "effect"},
  {message: "Use Result: its error says why a value is missing.", name: "effect/Option"}
];

// packages/vscode/src/vscode.api.ts holds the one runtime import of vscode; everything else yields VsCodeApi.
export const IMPORT_BANS = [
  ...OPTION_IMPORT_BANS,
  {allowTypeImports: true, message: "Import only vscode's types; yield VsCodeApi for its values.", name: "vscode"}
];

const DOMAIN_ALIASES = "domainServices|entities|valueObjects";
const APPLICATION_ALIASES = "interfaces|services|dtos";
const INFRASTRUCTURE_ALIASES = "config|models|di|logger|repositories|infraServices|infraUtils";

const DOMAIN_IMPORTS = {
  message: "The domain layer imports only effect and other domain code, through its aliases.",
  regex: `^(?!effect(/|$)|@(${DOMAIN_ALIASES})/)`
};

const APPLICATION_IMPORTS = {
  message:
    "The application layer imports only effect, @pkg/constants, and domain or application code, through their aliases.",
  regex: `^(?!effect(/|$)|@pkg/constants/|@(${DOMAIN_ALIASES}|${APPLICATION_ALIASES})/)`
};

const PRESENTATION_IMPORTS = {
  message:
    "Presentation's routes and middlewares import only effect, vscode types, @pkg, controllers, middlewares and " +
    "presenters.",
  regex: "^(?!effect(/|$)|vscode$|@pkg/|@(controllers|middlewares|presenters)/)"
};

const CONTROLLER_IMPORTS = {
  message:
    "A controller imports only effect, services, DTOs and @pkg/vscode's argument decoding: it decodes its input into " +
    "a request DTO and calls a service.",
  regex: "^(?!effect(/|$)|@(services|dtos)/|@pkg/vscode/src/vsCodeArgument\\.utils\\.ts$)"
};

const PRESENTER_IMPORTS = {
  message:
    "A presenter imports only effect, @pkg/constants, and services' types, whose failures it turns into messages.",
  regex: "^(?!effect(/|$)|@pkg/constants/|@services/)"
};

const VIEW_IMPORTS = {
  message: "A view imports only effect, vscode types, @pkg, controllers, its own files and DTOs' types.",
  regex: "^(?!effect(/|$)|vscode$|@pkg/|@(controllers|views|dtos)/)"
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
    "The infrastructure layer imports only effect, @effect, drizzle-orm, jsonc-parser, vscode types, node, @pkg, and " +
    "domain, application or infrastructure code, through their aliases.",
  regex: `^(?!effect(/|$)|@effect/|drizzle-orm(/|$)|jsonc-parser$|vscode$|node:|@pkg/|@(${DOMAIN_ALIASES}|${APPLICATION_ALIASES}|${INFRASTRUCTURE_ALIASES})/)`
};

// A later entry overrides an earlier one.
export const IMPORT_RULES = [
  ["domain", OPTION_IMPORT_BANS, [DOMAIN_IMPORTS]],
  ["application", OPTION_IMPORT_BANS, [APPLICATION_IMPORTS]],
  ["presentation", IMPORT_BANS, [PRESENTATION_IMPORTS]],
  ["presentation/controllers", IMPORT_BANS, [CONTROLLER_IMPORTS]],
  ["presentation/presenters", IMPORT_BANS, [PRESENTER_IMPORTS, SERVICE_TYPE_IMPORTS]],
  ["presentation/views", IMPORT_BANS, [VIEW_IMPORTS, DTO_TYPE_IMPORTS]],
  ["infrastructure", IMPORT_BANS, [INFRASTRUCTURE_IMPORTS]]
] as const;

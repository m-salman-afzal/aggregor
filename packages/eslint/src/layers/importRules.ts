export const OPTION_IMPORT_BANS = [
  {importNames: ["Option"], message: "Use Result: its error says why a value is missing.", name: "effect"},
  {message: "Use Result: its error says why a value is missing.", name: "effect/Option"}
];

export const IMPORT_BANS = [
  ...OPTION_IMPORT_BANS,
  {allowTypeImports: true, message: "Import only vscode's types; yield VsCodeApi for its values.", name: "vscode"}
];

const OWN_SPANS_IMPORT = String.raw`@pkg/trace/src/ownSpans\.utils\.ts$`;
const TAGGED_ERRORS_IMPORT = String.raw`@pkg/errors/src/taggedErrors\.utils\.ts$`;

export const ERRORS_PACKAGE_IMPORTS = {
  message:
    "Import only TaggedErrors from @pkg/errors (`@pkg/errors/src/taggedErrors.utils.ts`): a unit's errors are one " +
    "class that extends it, declared in the unit's own file.",
  regex: String.raw`^@pkg/errors/(?!src/taggedErrors\.utils\.ts$)`
};

const DOMAIN_ALIASES = "domainServices|entities|valueObjects";
const APPLICATION_ALIASES = "interfaces|services|dtos";
const INFRASTRUCTURE_ALIASES = "config|models|di|logger|repositories|infraServices|infraUtils";

const DOMAIN_IMPORTS = {
  message:
    "The domain layer imports only effect, @pkg/trace's ownSpans, @pkg/errors' TaggedErrors, and other domain " +
    "code, through its aliases.",
  regex: `^(?!effect(/|$)|${OWN_SPANS_IMPORT}|${TAGGED_ERRORS_IMPORT}|@(${DOMAIN_ALIASES})/)`
};

const APPLICATION_IMPORTS = {
  message:
    "The application layer imports only effect, @pkg/constants, @pkg/trace's ownSpans, @pkg/errors' TaggedErrors, " +
    "and domain or application code, through their aliases.",
  regex: `^(?!effect(/|$)|@pkg/constants/|${OWN_SPANS_IMPORT}|${TAGGED_ERRORS_IMPORT}|@(${DOMAIN_ALIASES}|${APPLICATION_ALIASES})/)`
};

const PRESENTATION_IMPORTS = {
  message:
    "A middleware imports only effect, vscode types, @pkg (ownSpans and VscodeUtils among it) and other middlewares: " +
    "it runs inside the controller that calls it, which hands it everything else.",
  regex: "^(?!effect(/|$)|vscode$|@pkg/|@middlewares/)"
};

const CONTROLLER_IMPORTS = {
  message:
    "A controller imports only effect, services, DTOs, middlewares, error messages, @pkg/constants, @pkg/trace's " +
    "ownSpans, @pkg/errors' TaggedErrors and @pkg/vscode's VscodeUtils, for argument decoding and the commands " +
    "that only drive VS Code: it registers its commands, decodes each one's input into a request DTO and calls a " +
    "service.",
  regex:
    "^(?!effect(/|$)|@(services|dtos|middlewares|errorMessages)/|@pkg/constants/|" +
    `${OWN_SPANS_IMPORT}|${TAGGED_ERRORS_IMPORT}|@pkg/vscode/src/vscode\\.utils\\.ts$)`
};

const ERROR_MESSAGE_IMPORTS = {
  message:
    "An error message imports only effect, @pkg/constants, @pkg/trace's ownSpans, @pkg/errors' TaggedErrors, and " +
    "services' types, whose failures it turns into messages.",
  regex: `^(?!effect(/|$)|@pkg/constants/|${OWN_SPANS_IMPORT}|${TAGGED_ERRORS_IMPORT}|@services/)`
};

const VIEW_IMPORTS = {
  message:
    "A view imports only effect, vscode types, @pkg, the controllers and its own utils classes it yields, and DTOs' " +
    "types: it draws what its controllers give it.",
  regex: "^(?!effect(/|$)|vscode$|@pkg/|@(controllers|views|dtos)/)"
};

const SERVICE_TYPE_IMPORTS = {
  allowTypeImports: true,
  message: "An error message imports only services' types.",
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
  ["presentation/errorMessages", IMPORT_BANS, [ERROR_MESSAGE_IMPORTS, SERVICE_TYPE_IMPORTS]],
  ["presentation/views", IMPORT_BANS, [VIEW_IMPORTS, DTO_TYPE_IMPORTS]],
  ["infrastructure", IMPORT_BANS, [INFRASTRUCTURE_IMPORTS]]
] as const;

// The code patterns banned with no-restricted-syntax: everywhere (SYNTAX_BANS), and per role in apps/extension.

const TAGGED_ERROR_CLASS =
  "ClassDeclaration[superClass.callee.callee.object.name='Schema'][superClass.callee.callee.property.name='TaggedError']";
const EXPORTED_TAGGED_ERROR_CLASS =
  "ExportNamedDeclaration[declaration.superClass.callee.callee.object.name='Schema']" +
  "[declaration.superClass.callee.callee.property.name='TaggedError']";

// Effect code's own bans: a missing value is a Result or UndefinedOr rather than ?. and ??, and a tag is matched with
// Match rather than switch or a _tag comparison. A front end without Effect, apps/webview, leaves them out.
export const EFFECT_SYNTAX_BANS = [
  {message: "No optional chaining: check the value explicitly.", selector: "ChainExpression"},
  {
    message: "No ??: check the value explicitly, or take a default with Result.getOrElse or UndefinedOr.match.",
    selector: "LogicalExpression[operator='??']"
  },
  {message: "No ??=: check the value explicitly.", selector: "AssignmentExpression[operator='??=']"},
  // Match fails the typecheck when a new tag has no branch; a comparison lets it fall through unnoticed.
  {
    message: "Match on a tag with Match.valueTags, or Match.tag and Match.exhaustive, instead of comparing _tag.",
    selector: "BinaryExpression[operator=/^[!=]==$/] > MemberExpression[property.name='_tag']"
  },
  {message: "Use Match instead of switch: it checks that every case has a branch.", selector: "SwitchStatement"}
];

export const OBJECT_DESTRUCTURING_BAN = {
  message:
    "No object destructuring: name the object and read each value as `object.key` where it is used (`props.sessionRow`, " +
    "`sessionListItem.status`), so a reader deep in a long function sees where every value comes from. Give a " +
    "parameter or a call's result a name of its own instead of a pattern. Array destructuring, such as " +
    "`const [value, setValue] = useState()`, stays.",
  selector: "ObjectPattern"
};

// A tag written by hand is a constant's value, so the sender, the type and every match read the same one name.
export const TAG_LITERAL_BAN = {
  message:
    "A `_tag` is never a string written in place: put it in its feature's constants as a labelled object " +
    "(`SESSIONS_VIEW_MESSAGE_TAGS.PROJECTS_DRAWN`), write the value as that constant, the type as " +
    "`typeof SESSIONS_VIEW_MESSAGE_TAGS.PROJECTS_DRAWN`, and a match's key as `[SESSIONS_VIEW_MESSAGE_TAGS.PROJECTS_DRAWN]`, " +
    "so the sender, the type and every match name one value and a rename changes them all.",
  selector: "Property[key.name='_tag'] > Literal.value, TSPropertySignature[key.name='_tag'] TSLiteralType"
};

export const GENERAL_SYNTAX_BANS = [
  // Where types sit is aggregor/type-placement's (rules/typePlacement.rule.ts): it needs to know what each type is
  // built from.
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
  {message: "Import by name: list what the file takes from the module.", selector: "ImportNamespaceSpecifier"},
  {message: "No else: return early from the if instead.", selector: "IfStatement[alternate]"},
  OBJECT_DESTRUCTURING_BAN,
  TAG_LITERAL_BAN
];

export const SYNTAX_BANS = [...EFFECT_SYNTAX_BANS, ...GENERAL_SYNTAX_BANS];

// A constant is a value: a literal, or a text with holes, an arrow whose whole body is one template literal. Picking
// between texts, or working a value out, happens in a util beside the code that uses it.
export const CONSTANT_BANS = [
  {
    message:
      "A constant text with holes is an arrow whose whole body is one template literal; pick between texts in a util.",
    selector: ":function:not(ArrowFunctionExpression[body.type='TemplateLiteral'])"
  },
  {
    message: "Constants hold no logic: pick or work out the value in a util beside the code that uses it.",
    selector:
      ":matches(ConditionalExpression, LogicalExpression, BinaryExpression, IfStatement, CallExpression, " +
      "NewExpression, SpreadElement)"
  }
];

// A value object that is a set of values is a Schema.Enum whose file exports the values as an UPPER_CASE constant
// (AGENT_STATUSES), the one copy of each string; code everywhere else imports that constant.
const SCHEMA_CALL = (schemaFunctionName: string) =>
  `CallExpression[callee.object.name='Schema'][callee.property.name='${schemaFunctionName}']`;
const EXPORTED_ENUM_VALUES = "ExportNamedDeclaration VariableDeclarator > MemberExpression.init[property.name='enums']";
export const ENUM_VALUE_OBJECT_BANS = [
  {
    message: "Make a set of values a Schema.Enum, and export its values as a constant.",
    selector: SCHEMA_CALL("Literals")
  },
  {
    message: "Export the enum's values beside its schema: export const <THINGS> = <Thing>ValueObjectSchema.enums.",
    selector: `Program:has(${SCHEMA_CALL("Enum")}):not(:has(${EXPORTED_ENUM_VALUES}))`
  }
];
export const ENUM_VALUES_ACCESS_BAN = {
  message: "Import the constant the value object exports (AGENT_STATUSES) instead of reading its schema's .enums.",
  selector: "MemberExpression[property.name='enums']"
};
// The states, kinds of wait and kinds of change are the strings code compares most, so comparing with one of them is an
// error too.
export const STATUS_LITERAL_BAN = {
  message:
    "Name the state through AGENT_STATUSES or SESSION_STATUSES, the kind of wait through STATUS_KINDS, and the kind " +
    "of change through ENTITY_CHANGE_KINDS.",
  selector:
    "BinaryExpression[operator=/^[!=]==$/] > " +
    "Literal[value=/^(unknown|idle|working|done|blocked|error|exited|permission|question|auth|placed|updated|removed)$/]"
};

// The CLIs a session runs are agents, one word everywhere, so a name or text calling them anything else is an error. The
// patterns spell the banned word in pieces, so this file doesn't match itself.
const OTHER_NAME_FOR_AGENTS = "/[Hh][Aa][Rr][Nn][Ee][Ss][Ss]/";
export const AGENT_NAME_BAN = {
  message: 'Call it an agent: the CLIs a session runs are "agents" in names, texts and settings.',
  selector:
    `Identifier[name=${OTHER_NAME_FOR_AGENTS}], Literal[value=${OTHER_NAME_FOR_AGENTS}], ` +
    `TemplateElement[value.raw=${OTHER_NAME_FOR_AGENTS}]`
};

// An interface's own types and error unions live in its .interface.ts; types several implementation files share, in a
// .type.ts.
export const EXPORTED_TYPE_BAN = {
  message: "Export types from a .type.ts or .interface.ts file; only a value object's type stays in its own file.",
  selector: "ExportNamedDeclaration > :matches(TSTypeAliasDeclaration, TSInterfaceDeclaration)"
};
export const SERVICE_CLASS_BAN = {
  message: "A Context.Service is an interface: declare it in a .interface.ts file.",
  selector:
    "ClassDeclaration > CallExpression.superClass > CallExpression.callee > MemberExpression[object.name='Context']"
};
export const ERROR_FILE_BAN = {
  message:
    "Declare errors at the top of the file that raises them, or of the interface whose signatures name them; " +
    "there are no .error.ts files.",
  selector: "Program"
};
// An entity file holds its entity, whose own rules are its methods; rules across entities go in a .domainService.ts.
export const ENTITY_EXPORT_BAN = {
  message: "Export only the entity class; a rule across entities goes in a .domainService.ts.",
  selector: "ExportNamedDeclaration:not([declaration.type='ClassDeclaration']), ExportDefaultDeclaration"
};
// Every domain service function is an Effect.fn, so each rule shows up in a trace as its own span.
export const DOMAIN_SERVICE_EXPORT_BAN = {
  message: "Export each domain service function as an Effect.fn, so it gets its span.",
  selector:
    "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator:not([init.callee.callee.object.name='Effect']" +
    "[init.callee.callee.property.name='fn']), ExportNamedDeclaration > FunctionDeclaration, ExportDefaultDeclaration"
};
// Every function is an Effect.fn, so each call shows up in a trace as its own span; functions nested in one are its
// callbacks.
export const PLAIN_FUNCTION_BAN = {
  message: "Declare each function as an Effect.fn, so it gets its span.",
  selector:
    "Program > VariableDeclaration > VariableDeclarator > :function, " +
    "Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > :function, " +
    "Program > FunctionDeclaration, ExportNamedDeclaration > FunctionDeclaration, ExportDefaultDeclaration > :function"
};
export const NON_TYPE_BAN = {
  message: "A .type.ts file holds only types.",
  selector:
    "Program > :not(ImportDeclaration, TSTypeAliasDeclaration, TSInterfaceDeclaration, " +
    "ExportNamedDeclaration[declaration.type=/^TS(TypeAlias|Interface)Declaration$/])"
};

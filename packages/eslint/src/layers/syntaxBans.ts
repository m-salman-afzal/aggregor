const TAGGED_ERROR_CLASS =
  "ClassDeclaration[superClass.callee.callee.object.name='Schema'][superClass.callee.callee.property.name='TaggedError']";
const EXPORTED_TAGGED_ERROR_CLASS =
  "ExportNamedDeclaration[declaration.superClass.callee.callee.object.name='Schema']" +
  "[declaration.superClass.callee.callee.property.name='TaggedError']";

// A front end without Effect, apps/webview, leaves these out.
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

export const TAG_LITERAL_BAN = {
  message:
    "A `_tag` is never a string written in place: put it in its feature's constants as a labelled object " +
    "(`SESSIONS_VIEW_MESSAGE_TAGS.PROJECTS_DRAWN`), write the value as that constant, the type as " +
    "`typeof SESSIONS_VIEW_MESSAGE_TAGS.PROJECTS_DRAWN`, and a match's key as `[SESSIONS_VIEW_MESSAGE_TAGS.PROJECTS_DRAWN]`, " +
    "so the sender, the type and every match name one value and a rename changes them all.",
  selector: "Property[key.name='_tag'] > Literal.value, TSPropertySignature[key.name='_tag'] TSLiteralType"
};

export const GENERAL_SYNTAX_BANS = [
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
export const STATUS_LITERAL_BAN = {
  message:
    "Name the state through AGENT_STATUSES or SESSION_STATUSES, the kind of wait through STATUS_KINDS, and the kind " +
    "of change through ENTITY_CHANGE_KINDS.",
  selector:
    "BinaryExpression[operator=/^[!=]==$/] > " +
    "Literal[value=/^(unknown|idle|working|done|blocked|error|exited|permission|question|auth|placed|updated|removed)$/]"
};

// The patterns spell the banned word in pieces, so this file doesn't match itself.
const OTHER_NAME_FOR_AGENTS = "/[Hh][Aa][Rr][Nn][Ee][Ss][Ss]/";
export const AGENT_NAME_BAN = {
  message: 'Call it an agent: the CLIs a session runs are "agents" in names, texts and settings.',
  selector:
    `Identifier[name=${OTHER_NAME_FOR_AGENTS}], Literal[value=${OTHER_NAME_FOR_AGENTS}], ` +
    `TemplateElement[value.raw=${OTHER_NAME_FOR_AGENTS}]`
};

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
export const ENTITY_EXPORT_BAN = {
  message: "Export only the entity class; a rule across entities goes in a .domainService.ts.",
  selector: "ExportNamedDeclaration:not([declaration.type='ClassDeclaration']), ExportDefaultDeclaration"
};
export const DOMAIN_SERVICE_EXPORT_BAN = {
  message: "Export each domain service function as an Effect.fn, so it gets its span.",
  selector:
    "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator:not([init.callee.callee.object.name='Effect']" +
    "[init.callee.callee.property.name='fn']), ExportNamedDeclaration > FunctionDeclaration, ExportDefaultDeclaration"
};
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

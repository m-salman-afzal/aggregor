const SCHEMA_TAGGED_ERROR_CLASS =
  "ClassDeclaration[superClass.callee.callee.object.name='Schema'][superClass.callee.callee.property.name='TaggedError']";
const ERRORS_CLASS = "ClassDeclaration[superClass.type='CallExpression'][superClass.callee.name='TaggedErrors']";
const EXPORTED_ERRORS_CLASS = "ExportNamedDeclaration[declaration.superClass.callee.name='TaggedErrors']";
const TOP_LEVEL_ERRORS_CLASS = `:matches(${ERRORS_CLASS}, ${EXPORTED_ERRORS_CLASS})`;
const EXPORTED_CODE =
  "ExportNamedDeclaration[declaration.type=/^(VariableDeclaration|FunctionDeclaration|ClassDeclaration)$/]";

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
  {message: "Use Match instead of switch: it checks that every case has a branch.", selector: "SwitchStatement"},
  // Math.sumPrecise is behind V8's --js-sum-precise flag in VS Code's extension host and has no TypeScript type yet.
  {
    message:
      "Sum numbers with sumAll from effect/Number (`sumAll(lineCounts)`), not a reduce that adds: its name says " +
      "what it does. Map the values to numbers first when they need converting.",
    selector:
      "CallExpression[callee.property.name='reduce'] > ArrowFunctionExpression > BinaryExpression.body[operator='+'], " +
      "CallExpression[callee.property.name='reduce'] > :function > BlockStatement > " +
      "ReturnStatement > BinaryExpression.argument[operator='+']"
  }
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

export const ERRORS_CLASS_BANS = [
  {
    message:
      "Declare an error as a key of the file's …Errors class (`SessionServiceErrors extends TaggedErrors({...})`), " +
      "not as a Schema.TaggedError class of its own, so every error the unit raises sits in one place.",
    selector: SCHEMA_TAGGED_ERROR_CLASS
  },
  {
    message:
      "Name the class that extends TaggedErrors after the file's unit or port class plus Errors (`SessionServiceErrors`, " +
      "`ITerminalInfraServiceErrors`), so a reader knows whose errors it holds.",
    selector: `${ERRORS_CLASS}:not([id.name=/Errors$/])`
  },
  {
    message:
      "Leave the …Errors class's body empty: TaggedErrors builds every error from its object, and the class only " +
      "names them. Put the behaviour in the unit that raises the error.",
    selector: `${ERRORS_CLASS} > ClassBody > *`
  },
  {
    message:
      "Pass TaggedErrors one object literal whose keys are the errors' tags, each ending in Error " +
      "(`TmuxUnavailableError: {foundVersion: Schema.String}`): the key is the tag that traces, catchTag and Match read.",
    selector:
      `${ERRORS_CLASS} > CallExpression.superClass > :not(ObjectExpression).arguments, ` +
      `${ERRORS_CLASS} > CallExpression.superClass > ObjectExpression.arguments > :not(Property[key.name=/Error$/])`
  },
  {
    message:
      "A file holds one …Errors class: move this class's errors into the first one as keys, so every error the unit " +
      "raises sits in one place.",
    selector: `Program > ${TOP_LEVEL_ERRORS_CLASS} ~ ${TOP_LEVEL_ERRORS_CLASS}`
  },
  {
    message:
      "Declare the …Errors class at the top of the file, after the imports and types and above the file's other " +
      "classes, so a reader sees how the unit fails before how it works.",
    selector:
      "Program > :matches(VariableDeclaration, FunctionDeclaration, ExpressionStatement, ExportDefaultDeclaration, " +
      `ClassDeclaration:not(${ERRORS_CLASS}), ${EXPORTED_CODE}:not(${EXPORTED_ERRORS_CLASS})) ~ ${TOP_LEVEL_ERRORS_CLASS}`
  }
];

export const GENERAL_SYNTAX_BANS = [
  {message: "Import by name: list what the file takes from the module.", selector: "ImportNamespaceSpecifier"},
  {message: "No else: return early from the if instead.", selector: "IfStatement[alternate]"},
  OBJECT_DESTRUCTURING_BAN,
  TAG_LITERAL_BAN
];

export const SYNTAX_BANS = [...EFFECT_SYNTAX_BANS, ...ERRORS_CLASS_BANS, ...GENERAL_SYNTAX_BANS];

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
const SERVICE_CLASS =
  "ClassDeclaration[superClass.callee.callee.object.name='Context'][superClass.callee.callee.property.name='Service']";
export const SERVICE_CLASS_BAN = {
  message:
    "A Context.Service class is either a port, declared in a .interface.ts file, or a unit whose make holds its " +
    "functions, declared in the file of a role that holds functions: .service.ts, .controller.ts, .errorMessage.ts, " +
    ".domainService.ts, .utils.ts, .transformer.ts, .view.ts, .infraService.ts, .repository.ts, .middleware.ts, " +
    ".layer.ts or infrastructure/config's .config.ts. A file that holds only definitions (a value object, entity, " +
    "DTO, model or type) declares no service class: move it to the file whose functions it holds.",
  selector:
    "ClassDeclaration > CallExpression.superClass > CallExpression.callee > MemberExpression[object.name='Context']"
};
export const SERVICE_LAYER_OWN_SPANS_BAN = {
  message:
    "Build a unit's layer with ownSpans: without it the unit's spans carry no owner in the trace log. Write " +
    '`Layer.effect(this, ownSpans("<Owner>", this.make()))`, or `Layer.effect(IPort, ownSpans("<Owner>", ' +
    "this.make()))` for a port's implementation.",
  selector:
    `${SERVICE_CLASS} > ClassBody > PropertyDefinition[static=true][key.name='layer']` +
    ":not(:has(CallExpression[callee.name='ownSpans']))"
};
const TOP_LEVEL_CONST = (declarationHolder: string) =>
  `${declarationHolder} > VariableDeclaration > VariableDeclarator > ` +
  ":matches(CallExpression.init[callee.callee.object.name='Effect'][callee.callee.property.name='fn'], " +
  "CallExpression.init[callee.object.name='Effect'][callee.property.name='fn'])";
export const TOP_LEVEL_FUNCTION_BAN = {
  message:
    "A file that holds functions exports one Context.Service class, and every function is a const inside its make, " +
    "where it reads the unit's dependencies once instead of yielding them on every call. Move this function into " +
    "the class's make.",
  selector: `${TOP_LEVEL_CONST("Program")}, ${TOP_LEVEL_CONST("Program > ExportNamedDeclaration")}`
};
export const DEPENDENCY_PARAMETER_BAN = {
  message:
    "A function reads services and shared state from the make it sits in; passing them along as a parameter hides " +
    "who depends on what. Yield the service once at the top of make, keep shared state in the make of the unit that " +
    "owns it, and use those values here.",
  selector:
    ":function > Identifier.params[name=/Dependencies$/], " +
    ":function > Identifier.params:has(TSTypeReference[typeName.name=/Dependencies$/])"
};
export const PROVIDE_MERGE_BAN = {
  message:
    "Use Layer.provide, not Layer.provideMerge: each level is closed before the next gets it, so a level never " +
    "hands on what it was given.",
  selector: "MemberExpression[object.name='Layer'][property.name='provideMerge']"
};
const EFFECT_FUNCTION_BODY =
  "CallExpression[callee.callee.object.name='Effect'][callee.callee.property.name='fn'] > :function.arguments:first-child";
export const NESTED_SERVICE_YIELD_BAN = {
  message:
    "A function inside another Effect.fn yields no service class and calls no service's .use: that puts the " +
    "service on every caller's requirements instead of on the layer once. Yield the service once at the top of make " +
    "and use that value here.",
  selector:
    `${EFFECT_FUNCTION_BODY} :function YieldExpression[delegate=true] > Identifier.argument[name=/^[A-Z]/], ` +
    `${EFFECT_FUNCTION_BODY} :function YieldExpression[delegate=true] > ` +
    "CallExpression.argument[callee.property.name='use'][callee.object.type='Identifier'][callee.object.name=/^[A-Z]/]"
};
const LAYER_CALL = (layerFunctionName: string) =>
  `CallExpression[callee.object.name='Layer'][callee.property.name='${layerFunctionName}']`;
export const LAYER_MERGE_SPAN_BAN = {
  message:
    'Give each merge of layers a span: write `Layer.mergeAll(...).pipe(Layer.withSpan("<Level>"))`, so startup ' +
    "nests under one span per merged level in the trace log and a slow or failing layer shows where it sits.",
  selector:
    `${LAYER_CALL("mergeAll")}:not(CallExpression[callee.property.name='pipe']` +
    `:has(> ${LAYER_CALL("withSpan")}.arguments) > MemberExpression.callee > CallExpression.object)`
};
export const ERROR_FILE_BAN = {
  message:
    "Declare errors as keys of the …Errors class in the file that raises them, or in the interface whose signatures " +
    "name them; there are no .error.ts files.",
  selector: "Program"
};
export const ENTITY_EXPORT_BAN = {
  message: "Export only the entity class; a rule across entities goes in a .domainService.ts.",
  selector: "ExportNamedDeclaration:not([declaration.type='ClassDeclaration']), ExportDefaultDeclaration"
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

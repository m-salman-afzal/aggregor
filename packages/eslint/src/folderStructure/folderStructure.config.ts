import {IMPORT_BANS} from "@pkg/eslint/src/layers/importRules.ts";
import {GENERAL_SYNTAX_BANS} from "@pkg/eslint/src/layers/syntaxBans.ts";
import {AGGREGOR_PLUGIN} from "@pkg/eslint/src/rules/aggregor.plugin.ts";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

import type {Config} from "eslint/config";

const WEBVIEW_SOURCE_FILES = "apps/webview/src/**/*.{ts,tsx}";

const LOGIC_HOOK_NAMES =
  "useActionState|useCallback|useDeferredValue|useEffect|useImperativeHandle|useInsertionEffect|useLayoutEffect|" +
  "useMemo|useOptimistic|useReducer|useRef|useState|useSyncExternalStore|useTransition";
const LOGIC_IN_COMPONENT_MESSAGE =
  "A component renders, and its hook holds the logic: state, effects, handlers and data reads go in " +
  "<component>.hook.ts, which the component calls once and draws what it returns, so the drawing reads at a glance " +
  "and the logic is found in one place. Move this into the component's hook.";

const ARROW_COMPONENT_MESSAGE =
  "A component is an arrow function, `export const SessionRow = () => …`, never a `function`: every component then " +
  "has the one shape, declared and exported like every other block, and is never used before the line that defines " +
  "it. Rewrite it as `const <Name> = (props: <Name>Props) => …`.";

const COMPONENT_SHAPE_BANS = [
  {message: ARROW_COMPONENT_MESSAGE, selector: "FunctionDeclaration[id.name=/^[A-Z]/]"},
  {message: ARROW_COMPONENT_MESSAGE, selector: "VariableDeclarator[id.name=/^[A-Z]/] > FunctionExpression.init"}
];

const COMPONENT_LOGIC_BANS = [
  {message: LOGIC_IN_COMPONENT_MESSAGE, selector: `CallExpression[callee.name=/^(${LOGIC_HOOK_NAMES})$/]`},
  {message: LOGIC_IN_COMPONENT_MESSAGE, selector: `CallExpression[callee.property.name=/^(${LOGIC_HOOK_NAMES})$/]`},
  {
    message: LOGIC_IN_COMPONENT_MESSAGE,
    selector: ":function :matches(VariableDeclarator > :function.init, FunctionDeclaration)"
  }
];

const WEBVIEW_IMPORT_PATTERNS = [
  {
    group: ["./*", "../*"],
    message:
      "Import through @/, the app's src, never a relative path: each file then has one import path, and moves " +
      "without breaking the files it imports."
  },
  {
    allowTypeImports: true,
    group: ["@dtos/*", "@valueObjects/*", "@views/*"],
    message:
      "Import the extension's message and DTO types with `import type`: the webview draws what the extension sends " +
      "and runs none of its code, so none of it may enter the webview's bundle."
  },
  {
    group: [
      "@applicationUtils/*",
      "@config/*",
      "@controllers/*",
      "@di/*",
      "@domainServices/*",
      "@entities/*",
      "@infraServices/*",
      "@infraUtils/*",
      "@interfaces/*",
      "@logger/*",
      "@middlewares/*",
      "@models/*",
      "@pkg/vscode/*",
      "@presentationUtils/*",
      "@presenters/*",
      "@repositories/*",
      "@services/*"
    ],
    message:
      "The webview reaches the extension only through the Sessions view's messages (sessions.service.ts), never its " +
      "code: the two run in different processes. Ask the view for what you need in a message."
  }
];

const EFFECT_HOOKS = "/^use(Layout|Insertion)?Effect$/";
const EFFECTS_LAST_BAN = {
  message:
    "A hook's effects come last, right before its return: useEffect and useLayoutEffect run after the draw that " +
    "reads everything above them, so placing them last shows that order and keeps the values a draw needs together " +
    "at the top. Move this statement above the hook's first effect.",
  selector:
    `ExpressionStatement[expression.callee.name=${EFFECT_HOOKS}] ~ ` +
    `:not(ExpressionStatement[expression.callee.name=${EFFECT_HOOKS}], ReturnStatement)`
};

const COMPONENT_DATA_IMPORT_PATTERN = {
  group: ["*.service.ts", "*.store.ts"],
  message: LOGIC_IN_COMPONENT_MESSAGE
};

export const FOLDER_STRUCTURE_CONFIGS: Config[] = [
  {...reactHooks.configs.flat["recommended-latest"], files: [WEBVIEW_SOURCE_FILES]},
  {
    files: [WEBVIEW_SOURCE_FILES],
    languageOptions: {globals: globals.browser},
    plugins: {aggregor: AGGREGOR_PLUGIN},
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {paths: IMPORT_BANS, patterns: WEBVIEW_IMPORT_PATTERNS}],
      "aggregor/building-block": "error",
      "aggregor/constant-placement": ["error", "constantFile"],
      "aggregor/file-role": "error",
      "aggregor/kind-folder": "error",
      "aggregor/module-boundary": "error",
      "aggregor/no-pass-through": "error",
      "aggregor/single-consumer": "error",
      "aggregor/stem-folder": "error",
      // shadcn's class-name merge is cn everywhere.
      "id-length": ["error", {exceptions: ["cn"], min: 3, properties: "never"}],
      "no-restricted-syntax": ["error", ...GENERAL_SYNTAX_BANS, EFFECTS_LAST_BAN],
      // aggregor/file-role checks every file and folder name, and says why.
      "unicorn/filename-case": "off",
      // A block's input is `props: <Block>Props` (aggregor/building-block), React's own word.
      "unicorn/name-replacements": [
        "error",
        {
          checkFilenames: false,
          replacements: {clicked: {chosen: true}, props: false, repo: {project: true, repository: false}}
        }
      ]
    }
  },
  {
    files: ["apps/webview/src/**/*.tsx"],
    ignores: ["apps/webview/src/main.tsx"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {paths: IMPORT_BANS, patterns: [...WEBVIEW_IMPORT_PATTERNS, COMPONENT_DATA_IMPORT_PATTERN]}
      ],
      "no-restricted-syntax": [
        "error",
        ...GENERAL_SYNTAX_BANS,
        EFFECTS_LAST_BAN,
        ...COMPONENT_SHAPE_BANS,
        ...COMPONENT_LOGIC_BANS
      ]
    }
  },
  {
    files: ["apps/webview/src/**/*.constant.ts"],
    rules: {"aggregor/constant-placement": "off"}
  }
];

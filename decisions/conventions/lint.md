# Lint

What lint checks, where its setup lives, and how its messages read.

## Lint and format on commit

- **Decision:** oxfmt and oxlint (see "Oxlint and oxfmt check everything"), run on staged files by husky and
  lint-staged.
- **Solution:** Gotcha: lint-staged checks the index, so files moved with `git mv` and then edited must be re-staged
  before a commit.

## Conventions are enforced by lint, not prose

- **Problem:** rules written only in AGENTS.md or DDD.md get skipped.
- **Decision:** each agreed convention gets a lint rule in the same PR: `no-restricted-syntax` selectors,
  `@typescript-eslint/naming-convention` per file glob, `no-restricted-imports` regexes, and the local rules in
  `packages/lint/src/rules/`. When no installed rule can check it, write a selector rather than add a plugin. Lint
  constrains Claude better than docs do.

## One import path per file

- **Decision:** one alias per folder under each layer, all under `@/` (`@/entities/`, `@/services/` and so on); lint
  rejects relative imports and `import * as`. Each file has one import path, and an import names what it takes. Under
  `@/`, oxfmt's `sortImports` counts every alias as internal with no list to keep up.
- **Solution:** `apps/extension/tsconfig.json` maps each `@/<folder>/*`. The webview's `@/*` is its own `src`, and it
  maps `@/dtos/*`, `@/valueObjects/*` and `@/views/*` to the extension's folders, since the DTOs it type-checks import
  each other through those paths; the more specific path wins in TypeScript and Vite.
- **Alternatives considered:** a single `@/*` alias; relative imports; the aliases as `@entities/` and so on, which
  oxfmt sorts as external unless each one is listed in `internalPattern`; `@extension/dtos/` and so on in the webview,
  which breaks because the extension's DTOs import `@/valueObjects/`, which the webview's `@/*` would send to its own
  `src`.

## A type sits below what it is built from

- **Problem:** lint kept every type at the top of its file, so `AgentListItemDto = typeof AgentListItemDtoSchema.Type`
  sat above the schema it comes from, and an error union above its errors.
- **Decision:** `aggregor/type-placement` in `packages/lint/src/rules/`, for every TypeScript file: a type built from a
  value of its own file (a schema, an errors class, a function), directly or through another such type, sits below the
  last of them; a type that stands alone stays at the top, after the imports. It replaced the `no-restricted-syntax`
  selector for types, and `perfectionist/sort-modules` now splits its sorting at blank lines, so such a type can follow
  the classes it names. A file reads top down, each name defined before what is built from it.
- **Alternatives considered:** dropping the rule, which lets standalone types scatter; an esquery selector, which can't
  tell what a type refers to.

## The lint setup lives in `@pkg/lint`

- **Problem:** `eslint.config.ts`, `eslint.layers.ts` and `eslint.plugin.ts` at the root had grown to about 900 lines.
- **Decision:** a workspace package, `packages/lint`: `src/base/` the base setup (the preset rules, the repo's own
  settings, the shadcn override, typescript-eslint's rules for oxlint, ignores), `src/layers/` the DDD layering (import
  allow-lists, syntax bans, role names, and the per-folder configs that combine them), `src/rules/` the aggregor plugin,
  one file per rule, and `src/lint.config.ts`, oxlint's config, which the root `oxlint.config.ts`, where oxlint looks,
  only re-exports. The lint plugins are the package's dependencies; the root keeps the tools for its scripts. Each
  concern has its own small file, and the root holds only what tools require there.
- **Alternatives considered:** moving only the layering and the plugin, and keeping the base setup at the root; one file
  per category (base, layers, rules) instead of one per concern.

## The folder structure is linted, and every message says why

- **Problem:** the folder-structure skill's rules, left to review, drift; the user asked for each to be a lint whose
  message says what is wrong, why and what to do.
- **Decision:** `@pkg/lint`'s `folderStructure/` turns on, for `apps/webview/src`: `file-role` (camelCase files and
  folders, a role suffix, no index files), `building-block` (one block a file, named as its file), `kind-folder` (one of
  a kind beside the main file, two in the kind's folder, no folder with one entry), `stem-folder`, `module-boundary`,
  `no-pass-through`, `single-consumer` (nothing unused, a type or a core file with one consumer moves to it, and a file
  whose importers sit in one unit moves into it), `constant-placement` (a `.constant.ts`, or `@pkg/constants`), and
  `no-restricted-syntax` for a component's own state, effects and handlers, which go in its hook. Effect's syntax bans
  (`?.`, `??`, `switch`, comparing `_tag`) stay with the extension; React's hooks rules and the React Compiler's run
  too. `packages/lint/tests` checks the rules on a small app on disk, and `pnpm test` runs it. A convention without a
  lint drifts ("Conventions are enforced by lint, not prose"), and a message that says why lets an agent fix the cause,
  not the symptom.
- **Solution:** `single-consumer` reads every file's imports, so a file's report depends on others; oxlint keeps no
  cache, so every run sees a move elsewhere.

## Components are arrow functions

- **Decision:** a webview component is an arrow, `export const SessionRow = (…) => …`, never a `function` declaration or
  expression. `no-restricted-syntax` in `folderStructure.config.ts` bans both for a PascalCase name in a `.tsx`, with a
  message that says why; ESLint's `func-style` already turned down `function` declarations, without saying why. shadcn's
  generated `button.tsx` and `collapsible.tsx` were rewritten as arrows by hand. The user's call: one shape for every
  component, the same as every other function in the codebase.
- **Solution:** `@pkg/ui`'s `components/` keep shadcn's style otherwise, so the rest of lint skips them, and
  `shadcn.config.ts` checks only this rule there: `shadcn add` writes `function` declarations, and lint fails them until
  they are rewritten as arrows. Without that check, the combobox landed with sixteen `function`s that this note alone
  didn't stop.

## No object destructuring

- **Problem:** a value destructured at the top of a long function shows no trace of where it came from by the time it is
  used, and ESLint's `prefer-destructuring` demanded exactly that.
- **Decision:** objects are never destructured: code names the object and reads `object.key` where the value is used
  (`sessionListItem.status`, `props.sessionRow`). Array destructuring (`const [value, setValue] = useState()`) and named
  imports stay. A reader sees each value's source at the line that uses it, and reading a property costs nothing.
- **Solution:** `no-restricted-syntax` bans `ObjectPattern` everywhere (`OBJECT_DESTRUCTURING_BAN` in
  `packages/lint/src/layers/syntaxBans.ts`), with a message that says why and what to write instead; ESLint's and
  typescript-eslint's `prefer-destructuring` are off. A parameter that was a pattern is named after its type
  (`commitMessageRequest: CommitMessageRequest`), a `Match` handler's after its tag, or `error` in an error message.
  Where a VS Code getter or narrowing inside a callback needs it, a value is read once into a named const.
- **Alternatives considered:** destructuring only small objects, which needs a size to argue about; banning it only in
  the webview, which leaves the extension's long Effect functions as they were.

## A block takes `props: <Block>Props`, and its file holds nothing else

- **Problem:** components and hooks took their input in different shapes, and their files gathered helpers, constants
  and types, so a block didn't read at a glance.
- **Decision:** in the webview, a component, hook, context or other block takes one parameter, `props`, typed
  `<Block>Props` (a hook's is `Use<Name>Props`, as in `UseSessionRowProps`), declared unexported at the file's top. The
  file holds the block and that type and nothing else: helpers go to `<stem>.utils.ts`, constants to
  `<stem>.constant.ts` and other types to `<stem>.type.ts`, beside it. A store also keeps its state and the functions
  that change it. `props`, React's own word, is allowed there instead of the repo's `properties`.
- **Solution:** `aggregor/building-block` reports a block whose input isn't one `props: <Block>Props` (`propsParameter`)
  and anything else in its file (`extraDeclaration`, naming the sibling file to move it to); `aggregor/single-consumer`
  lets a `.type.ts` that only a block's file imports stay. `unicorn/name-replacements` allows `props` in `apps/webview`.
- **Alternatives considered:** keeping a type one file uses at that file's top, as the folder-structure skill had it,
  which puts helper types in a block's file; any parameter shape a block likes.

## A hook's effects come last

- **Problem:** an effect in the middle of a hook reads as if it ran there, while it runs after the draw.
- **Decision:** a hook's `useEffect` and `useLayoutEffect` calls come last, right before its return. The order on the
  page then matches the order things run in, and the values a draw needs sit together at the top.
- **Solution:** `no-restricted-syntax` in `folderStructure.config.ts` reports any statement after a hook's first effect
  other than another effect or the return.

## A hook returns names, never functions written in its return

- **Problem:** hooks wrote their handlers inline in the object they return, so the return mixed what the hook gives its
  component with how each handler works, and a handler had no name of its own to find.
- **Decision:** a hook declares each handler it returns as a `const` above its return, and the return lists names and
  values only. A handler that only answers a store's state, as the user-input dialog's answers do, is a store action the
  hook selects, so the hook holds no copy of that logic.
- **Solution:** `no-restricted-syntax` in `folderStructure.config.ts`, for `*.hook.ts` files, reports a function written
  as a property's value anywhere inside a returned object (`ReturnStatement ObjectExpression > Property > :function`). A
  callback passed to a call in the return, such as `rows.map(…)`, is not a property's value and stays allowed.
- **Alternatives considered:** handlers built by a helper and spread into the return (`makeFormAnswers`), which only
  moved the inline functions out of sight.

## A `_tag` is a constant, never a string written in place

- **Problem:** the Sessions view's messages and the agent picker's result wrote their tags as strings at the sender, in
  the type and in each match, so a rename had to find every copy.
- **Decision:** every tag written by hand is a value in its feature's constants, as a labelled object
  (`SESSIONS_VIEW_MESSAGE_TAGS`, `SESSIONS_WEBVIEW_MESSAGE_TAGS`, `AGENT_PICK_TAGS`); the sender writes the constant,
  the type `typeof` it, and a `Match.valueTags` key `[CONSTANT]`. One name per tag, shared by the extension and the
  webview.
- **Solution:** `TAG_LITERAL_BAN` in `packages/lint/src/layers/syntaxBans.ts` reports a string literal as a `_tag`'s
  value or type, everywhere. Tags that a `TaggedErrors` key or a `Schema.TaggedUnion` defines stay their schemas', and
  matches on them keep the tag names as keys.
- **Alternatives considered:** only the webview's messages, which leaves the same string copies in the extension.

## Every scrolling element uses `scrollbar-minimal`

- **Problem:** the thin scrollbar was a class to remember, and new scroll areas (the import and cleanup lists, the
  menus) kept shipping VS Code's thick webview scrollbar.
- **Decision:** any class list in `apps/webview` or `@pkg/ui` that scrolls (`overflow-auto`, `overflow-y-scroll` and the
  like, with any variant prefix) carries `scrollbar-minimal` too. shadcn's components are checked as well, since their
  menus scroll.
- **Solution:** `aggregor/minimal-scrollbar` reads every string and template part; when one scrolls, it looks for
  `scrollbar-minimal` across the whole expression around it, so a class list split over `+`, `cn(...)` or a template
  still counts as one.
- **Alternatives considered:** a `ScrollArea` component, which every list would have to be rewritten into; a global
  `::-webkit-scrollbar` style, which would also restyle scrollbars we don't own and lose the per-element hover reveal.

## The unit form is linted

- **Decision:** each part of the unit form ("A unit is an Effect service class that yields what it needs once" in
  `architecture/dependencyInjection.md`) is a lint whose message says what is wrong, why and what to write instead:
  where a class may sit, its layer, where it yields, its names and its levels' spans ("Conventions are enforced by lint,
  not prose").
- **Solution:** in `packages/lint/src/layers/`:
  - `SERVICE_CLASS_BAN` allows a `Context.Service` class in every role that holds functions (a service, controller,
    error message, domain service, utils, transformer, view, infra service, repository, middleware, layer file or
    `infrastructure/config`'s config) and in a port's `.interface.ts`, and bans it in a file that holds only
    definitions.
  - `TOP_LEVEL_FUNCTION_BAN` bans a top-level `Effect.fn` in `apps/extension/src` and `packages/vscode/src`, with no
    exemption: every function is a const inside its class's `make`.

  - `NESTED_SERVICE_YIELD_BAN` fails a function inside another `Effect.fn` that yields a service class or calls a
    service's `.use`: the unit yields it once at the top of `make`.
  - `DEPENDENCY_PARAMETER_BAN` fails any parameter named or typed `…Dependencies`: a function reads services and shared
    state from the `make` it sits in.
  - `LAYER_MERGE_SPAN_BAN` fails a `Layer.mergeAll` in `infrastructure/di/` or `extension.ts` without
    `.pipe(Layer.withSpan("<Level>"))`, and `PROVIDE_MERGE_BAN` any `Layer.provideMerge` in `app.layer.ts` or
    `extension.ts`, where the levels meet.
  - `roleNames.ts` names each unit's class for its role: `<X>Service`, `<X>Controller`, `<X>ErrorMessage`,
    `<X>DomainService`, `<X>Utils`, `<X>Transformer`, `<X>View`, `<X>InfraService`, `<X>Repository`, `<X>Config` and
    `<X>Middleware`; a layer file's exported layer ends in `Layer`.
  - `@pkg/vscode`'s `.utils.ts` files get the extension's utils rules: the class, the ban on a top-level `Effect.fn`,
    and the `Utils` name.
  - `importRules.ts` gives error messages their own allow-list (`effect`, `@pkg/constants`, and services' types), lets a
    controller import the middleware, error messages and `@pkg/constants` it registers its commands with, and
    `@pkg/vscode`'s `vscode.utils.ts`, whose `VscodeUtils` decodes its input and opens the settings, and lets every
    layer, and `@pkg/vscode`, import `@pkg/errors`' `TaggedErrors`, and nothing else from `@pkg/errors`.
  - The rules on which class a role's file may hold, and its name, accept a file's `…Errors` class beside its unit class
    and don't take it for a unit. `packages/errors/src` is under the same code rules as `packages/vscode/src`, without
    the unit rules.

  In `packages/lint/src/rules/`, `aggregor/span-name` names a class's `make` span `<Class>.make` and every other
  `Effect.fn` span `<Class>.<const>`, writes the name with `--fix`, and checks that a unit's class is named after its
  file, which for every file with a role is the file itself (`terminal.utils.ts` is `TerminalUtils`).
  `aggregor/max-lines-per-function` replaces ESLint's own rule so a class's `make`, or a `make<Name>` const such as
  `makeFor`, that holds `Effect.fn`s is exempt while each function inside stays capped at 30 lines.
  `unicorn/name-replacements` allows `utils` and `application` as words, since they name a role and a layer.

## Oxlint and oxfmt check everything

- **Problem:** ESLint with typed rules over the whole repo took about 8 GB without its cache, enough for the kernel to
  kill the run and the session with it, and Prettier was a second slow pass.
- **Decision:** oxlint lints, with type-aware rules through `oxlint-tsgolint`, and oxfmt formats; ESLint and Prettier
  are gone. The rules stay the ones ESLint ran: the presets the repo turned on (ESLint's and typescript-eslint's `all`,
  perfectionist's alphabetical, e18e's recommended, React's hooks and compiler rules) are kept as rule lists in oxlint's
  names, and the repo's own settings and per-file overrides are written in oxlint's shape on top. A rule oxlint lacks
  runs as a JS plugin: ESLint's core rules through `oxlint-plugin-eslint` (`eslint-js/no-restricted-syntax`,
  `newline-before-return`, `consistent-this`, `require-atomic-updates`, `strict`, `no-restricted-exports`,
  `no-unreachable-loop`, `no-useless-assignment`), typescript-eslint's `naming-convention`, `member-ordering` and
  `no-restricted-imports` (`typescript-js/…`; oxlint's own `no-restricted-imports` reads Rust regexes, which have no
  lookahead for the layers' allow-lists), unicorn's `name-replacements`, perfectionist, e18e and the aggregor plugin.
  oxfmt's built-in sorting replaces sorting that was a lint rule or nothing: `sortImports` (in place of
  `perfectionist/sort-imports`; value imports first, by builtin, external, internal, parent, sibling and index, then
  type imports in the same order, with a blank line between groups; `internalPattern` is `@/` and `@pkg/`, since oxfmt
  otherwise sorts the workspace packages as external), `sortPackageJson` (in place of eslint-package-json's sort rules)
  and `sortTailwindcss`.
- **Solution:** `pnpm lint:check` is `oxlint`, in about 3 seconds and 1 GB; `pnpm format:check` is `oxfmt --check`.
  `packages/lint/src/lint.config.ts` is the config, re-exported by the root `oxlint.config.ts`, with `maxWarnings: 0`
  and unused disable directives as errors. A file named `oxlint.config.ts` below the root would be read as a nested
  config, hence `lint.config.ts`. oxlint fails on a rule name it doesn't know, so a rule that moves between oxlint and a
  plugin shows at once. Disable comments are `oxlint-disable…` with oxlint's names (`eslint-js/no-restricted-syntax`,
  `typescript/…`). Rules dropped, each already covered or not runnable: `camelcase` (by `naming-convention`),
  `no-dupe-args`, `no-octal`, `no-octal-escape`, `no-invalid-this` and its typescript-eslint copy (TypeScript's strict
  mode), `no-undef` (TypeScript), `no-undef-init` (unicorn's `no-useless-undefined`), typescript-eslint's
  `no-unsafe-class-instance-assignment` (needs types, which a JS plugin doesn't get), React Compiler's `config` and
  `gating` (oxlint fixes the compiler's options). Turned off to keep what ESLint reported: `curly` and
  `no-unexpected-multiline`, which Prettier's ESLint config had turned off, `init-declarations`, which ESLint's config
  set with no mode and so never reported, and e18e's `prefer-spread-syntax`, which tells an array's `concat` from
  `Stream.concat` only by type. Effect's `A`, `E`, `R` type parameters are `id-length`'s exceptions, since oxlint reads
  type parameters and ESLint didn't. Checked by comparing, for each of the repo's 372 TypeScript files, the rules the
  old and the new config apply: the same. Gone with ESLint, since oxlint lints only JavaScript and TypeScript and its JS
  plugins can't read other file types: JSON key order, the Markdown rules (link fragments, heading order, alt text and
  the rest) and eslint-plugin-pnpm's catalog checks; pnpm's `catalogMode: strict` still writes `catalog:` on `pnpm add`.
  The `eslint` package stays installed only as a peer of perfectionist, e18e and typescript-eslint's plugin; nothing
  runs it. oxlint's JS plugins are alpha and outside semver, and oxfmt is beta, so each is pinned and a bump is checked
  by hand.
- **Alternatives considered:** ESLint kept for JSON, Markdown and the catalog checks, as a second, small run; ESLint for
  everything, given more memory; a converter from the ESLint-shaped configs to oxlint's, built first and dropped once
  ESLint was gone, since it only translated names; oxlint's migration tool's output as the config, which drops
  typescript-eslint's file-scoped offs and the rules it can't carry; Vite+, whose one config holds both tools' settings,
  a toolchain of its own for one file fewer; Biome.

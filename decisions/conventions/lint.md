# Lint

What lint checks, where its setup lives, and how its messages read.

## Lint and format on commit

- **Decision:** ESLint (typescript-eslint, unicorn, perfectionist, import-x, promise, e18e, markdown, json, package-json
  and the local aggregor plugin) and Prettier, run on staged files by husky and lint-staged.
- **Solution:** Gotcha: lint-staged checks the index, so files moved with `git mv` and then edited must be re-staged
  before a commit.

## Conventions are enforced by lint, not prose

- **Problem:** rules written only in AGENTS.md or DDD.md get skipped.
- **Decision:** each agreed convention gets an ESLint rule in the same PR: `no-restricted-syntax` selectors,
  `@typescript-eslint/naming-convention` per file glob, `no-restricted-imports` regexes, and the local rules in
  `packages/eslint/src/rules/`. When no installed rule can check it, write a selector rather than add a plugin. Lint
  constrains Claude better than docs do.

## One import path per file

- **Decision:** one alias per folder under each layer; lint rejects relative imports and `import * as`. Each file has
  one import path, and an import names what it takes.
- **Alternatives considered:** a single `@/*` alias; relative imports.

## A type sits below what it is built from

- **Problem:** lint kept every type at the top of its file, so `AgentListItemDto = typeof AgentListItemDtoSchema.Type`
  sat above the schema it comes from, and an error union above its errors.
- **Decision:** `aggregor/type-placement` in `packages/eslint/src/rules/`, for every TypeScript file: a type built from
  a value of its own file (a schema, an error class, a function), directly or through another such type, sits below the
  last of them; a type that stands alone stays at the top, after the imports. It replaced the `no-restricted-syntax`
  selector for types, and `perfectionist/sort-modules` now splits its sorting at blank lines, so such a type can follow
  the classes it names. A file reads top down, each name defined before what is built from it.
- **Alternatives considered:** dropping the rule, which lets standalone types scatter; an esquery selector, which can't
  tell what a type refers to.

## The ESLint setup lives in `@pkg/eslint`

- **Problem:** `eslint.config.ts`, `eslint.layers.ts` and `eslint.plugin.ts` at the root had grown to about 900 lines.
- **Decision:** a workspace package, `packages/eslint`: `src/base/` the setup per file type (TypeScript, JSON, Markdown,
  `package.json` with the pnpm catalog, ignores), `src/layers/` the DDD layering (import allow-lists, syntax bans, role
  names, and the per-folder configs that combine them), `src/rules/` the aggregor plugin, one file per rule, and
  `src/eslint.config.ts`, which composes them. The root `eslint.config.ts`, where ESLint looks, only re-exports it. The
  lint plugins are the package's dependencies; the root keeps `eslint` for its scripts. `tsconfigRootDir` is set to the
  repo root, since typescript-eslint would otherwise look for tsconfigs no higher than the package's `src`. Each concern
  has its own small file, and the root holds only what tools require there.
- **Alternatives considered:** moving only the layering and the plugin, and keeping the base setup at the root; one file
  per category (base, layers, rules) instead of one per concern.

## The folder structure is linted, and every message says why

- **Problem:** the folder-structure skill's rules, left to review, drift; the user asked for each to be a lint whose
  message says what is wrong, why and what to do.
- **Decision:** `@pkg/eslint`'s `folderStructure/` turns on, for `apps/webview/src`: `file-role` (camelCase files and
  folders, a role suffix, no index files), `building-block` (one block a file, named as its file), `kind-folder` (one of
  a kind beside the main file, two in the kind's folder, no folder with one entry), `stem-folder`, `module-boundary`,
  `no-pass-through`, `single-consumer` (nothing unused, a type or a core file with one consumer moves to it, and a file
  whose importers sit in one unit moves into it), `constant-placement` (a `.constant.ts`, or `@pkg/constants`), and
  `no-restricted-syntax` for a component's own state, effects and handlers, which go in its hook. Effect's syntax bans
  (`?.`, `??`, `switch`, comparing `_tag`) stay with the extension; React's hooks rules and the React Compiler's run
  too. `packages/eslint/tests` checks the rules on a small app on disk, and `pnpm test` runs it. A convention without a
  lint drifts ("Conventions are enforced by lint, not prose"), and a message that says why lets an agent fix the cause,
  not the symptom.
- **Solution:** `single-consumer` reads every file's imports, and ESLint's cache doesn't know a file's report depends on
  others, so a cached run can miss a move elsewhere; CI's run has no cache.

## Components are arrow functions

- **Decision:** a webview component is an arrow, `export const SessionRow = (…) => …`, never a `function` declaration or
  expression. `no-restricted-syntax` in `folderStructure.config.ts` bans both for a PascalCase name in a `.tsx`, with a
  message that says why; ESLint's `func-style` already turned down `function` declarations, without saying why. shadcn's
  generated `button.tsx` and `collapsible.tsx` were rewritten as arrows by hand. The user's call: one shape for every
  component, the same as every other function in the codebase.
- **Solution:** lint skips `@pkg/ui`'s `components/base`, so a component `shadcn add` writes comes with `function`
  declarations; rewrite them as arrows when adding it.

## No object destructuring

- **Problem:** a value destructured at the top of a long function shows no trace of where it came from by the time it is
  used, and ESLint's `prefer-destructuring` demanded exactly that.
- **Decision:** objects are never destructured: code names the object and reads `object.key` where the value is used
  (`sessionListItem.status`, `props.sessionRow`). Array destructuring (`const [value, setValue] = useState()`) and named
  imports stay. A reader sees each value's source at the line that uses it, and reading a property costs nothing.
- **Solution:** `no-restricted-syntax` bans `ObjectPattern` everywhere (`OBJECT_DESTRUCTURING_BAN` in
  `packages/eslint/src/layers/syntaxBans.ts`), with a message that says why and what to write instead; ESLint's and
  typescript-eslint's `prefer-destructuring` are off. A parameter that was a pattern is named after its type
  (`workspaceDependencies: WorkspaceDependencies`), a `Match` handler's after its tag, or `error` in a presenter. Where
  a VS Code getter or narrowing inside a callback needs it, a value is read once into a named const.
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

## A `_tag` is a constant, never a string written in place

- **Problem:** the Sessions view's messages and the agent picker's result wrote their tags as strings at the sender, in
  the type and in each match, so a rename had to find every copy.
- **Decision:** every tag written by hand is a value in its feature's constants, as a labelled object
  (`SESSIONS_VIEW_MESSAGE_TAGS`, `SESSIONS_WEBVIEW_MESSAGE_TAGS`, `AGENT_PICK_TAGS`); the sender writes the constant,
  the type `typeof` it, and a `Match.valueTags` key `[CONSTANT]`. One name per tag, shared by the extension and the
  webview.
- **Solution:** `TAG_LITERAL_BAN` in `packages/eslint/src/layers/syntaxBans.ts` reports a string literal as a `_tag`'s
  value or type, everywhere. Tags that `Schema.TaggedError` and `Schema.TaggedUnion` define stay their schemas', and
  matches on them keep the tag names as keys.
- **Alternatives considered:** only the webview's messages, which leaves the same string copies in the extension.

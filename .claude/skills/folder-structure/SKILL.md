---
name: folder-structure
description:
  Where every file in a front end goes. Each feature is a module with page use cases, cross-cutting code sits in a
  shared core, and files are camelCase and named by role (`sessionRow.tsx`, `sessionRow.hook.ts`), one building block
  per file. Files stay flat until a unit has files of its own or a level holds two of a kind, and code stays local until
  a second consumer needs it. Use whenever you create, move, rename, split or delete a component, hook, context, store,
  util, constant, type, schema, service, layout or page in a React or other component-based front end, set up a new
  front-end app or package, or review where code was placed, even when the user only asks "where should this go" and
  never says "folder structure".
---

# Folder structure

This skill lays out a front end so that each feature lives in one folder that can be deleted in one go, with no more
nesting than the code needs. Every rule below serves one test:

> **The delete test.** Delete a feature module's folder, and the rest of the code still compiles, or breaks only in the
> route file that mounted it.

When you add a file, follow [Placing a new file](#placing-a-new-file). When you review a change, go through the
[review checklist](#review-checklist). Where a repo documents a layout of its own (in `AGENTS.md`, `CLAUDE.md` or a
rules file), that layout wins, and this skill fills in only what it leaves open.

## Principles

1. **Every feature is a module.** A module owns its components, hooks, contexts, constants, types, schemas, stores,
   services and utils. When the feature goes, its folder goes with it.
2. **Every page is a use case of a module.** A module can be mounted on several pages. Each mount is a use case built
   from the module's shared parts.
3. **Cross-cutting code lives in `core`.** Feature modules import from `core`, and `core` imports no feature module.
4. **Code shared by several apps lives in `packages/*`** (in a monorepo). Apps import packages, and packages never
   import apps.
5. **camelCase all the way, and a file's suffix names its role.** `sessionRow.tsx` is a component, `sessionRow.hook.ts`
   its hook, `sessionRow.constant.ts` its constants.
6. **One building block per file.** A file holds one component, hook, context, provider, store, layout, use case or
   icon. Constants, types, utils, services and schemas are small cogs, so one file holds as many as its owner needs.
7. **Flat until there are two.** A unit is one file until it has files of its own, and then they share a folder named
   after it. A level holds one file of a kind next to its main file, and a second one of that kind gives the kind its
   folder (`hooks/`, `components/`).
8. **Start local, and promote on the second consumer.** Code starts as deep in the tree as it can, and moves up only
   when a second consumer appears.

## Layout

### Monorepo

```text
<repo>/
├── apps/              # Deployable apps, which compose modules and packages
│   └── <app>/
└── packages/          # App-agnostic workspace packages, grouped by kind
    ├── configs/       # Shared lint and TypeScript configs
    ├── constants/     # Constants several apps use (routes, keys, enums)
    ├── contexts/
    ├── hooks/
    ├── icons/
    ├── schemas/       # Payload schemas, the single source of each shape
    ├── services/      # API clients, one package per backend domain
    ├── sharedCore/    # Core code that several apps grew alike
    ├── types/
    ├── ui/            # The design system
    └── utils/
```

A repo has only the packages it needs. The rules at this level:

- Apps depend on packages, never the other way around.
- A package depends on another package only when that one is generic. `ui` never imports `services`. A package that
  needs a domain package is holding code that belongs in a module.
- Packages are imported through a stable alias (`@pkg/<package>`), with one export path per entry (`@pkg/ui/button`), so
  the bundler can drop what an app doesn't use.

A repo with one app drops the `apps/` and `packages/` split, and everything below lives under its `src/`.

### The app

An app's `src/` holds three things only:

- the routing tree (`app/`, or the folder its router reads)
- `modules/`
- the root files its framework requires, such as middleware

## Files and folders

### A file's suffix names its role

A file is `<name>.<role>.ts`, or `.tsx` when it contains JSX. A component takes no role, so a `.tsx` file without one is
a component. The name is the unit the file belongs to, or the subject of shared code.

**Building blocks, one per file:**

| Role      | File               | Holds, for example  |
| --------- | ------------------ | ------------------- |
| Component | `<x>.tsx`          | `SessionRow`        |
| Hook      | `<x>.hook.ts`      | `useSessionRow`     |
| Context   | `<x>.context.ts`   | `ShareMenuContext`  |
| Provider  | `<x>.provider.tsx` | `ShareMenuProvider` |
| Store     | `<x>.store.ts`     | `useSessionsStore`  |
| Layout    | `<x>.layout.tsx`   | `DashboardLayout`   |
| Use case  | `<x>.useCase.tsx`  | `UploadsPage`       |
| Icon      | `<x>.icon.tsx`     | `FolderIcon`        |

These are what a front end is built from, so each gets its own file. The file name says exactly what is inside, and a
block moves on its own when it is promoted. Hot reload also depends on it: Fast Refresh keeps a component's state only
when the edited file exports nothing but components, so a component file that also exports a hook or a context reloads
more than it should.

**Small cogs, as many per file as the owner needs:**

| Role     | File              | Holds                               |
| -------- | ----------------- | ----------------------------------- |
| Constant | `<x>.constant.ts` | Constants                           |
| Type     | `<x>.type.ts`     | Types that two or more files share  |
| Utils    | `<x>.utils.ts`    | Pure functions                      |
| Service  | `<x>.service.ts`  | The API calls of one backend domain |
| Schema   | `<x>.schema.ts`   | Validation schemas                  |

A level usually has one file of each, named after its main file, and cogs promoted to that level join it.

A file holds only its role, plus the types that only it uses. There are no `index.ts` files: a unit is never a folder
holding an `index`.

### A unit's files share its folder

A unit is one file for as long as it is one file. Once it has files of its own (its hook, its constants, a sub-component
only it uses), they all go in a folder named after it, and its main file keeps that name:

```text
components/
├── assetCard.tsx              # No files of its own, so no folder
└── settingsBar/
    ├── settingsBar.tsx
    └── settingsBar.hook.ts    # useSettingsBar, the bar's logic
```

### One of a kind sits flat, two get a folder

A folder's main file, named after it, sits at its root. Every other file sits next to it while it is the only one of its
kind. When a second one of that kind arrives, both move into the kind's plural folder: `components/`, `hooks/`,
`contexts/`, `providers/`, `stores/`, `layouts/`, `useCases/`, `icons/`, `modules/`, and for split cogs `constants/`,
`types/`, `utils/`, `services/` or `schemas/`. So a component that needs two hooks keeps them in a `hooks/` folder
beside it:

```text
settingsBar/
├── settingsBar.tsx
└── shareFolderButton/                   # The bar's only sub-component, so no components/
    ├── shareFolderButton.tsx
    ├── shareFolderButton.constant.ts    # Its only constants file
    ├── contexts/                        # Two contexts, so they get a folder
    │   ├── inviteForm.context.ts
    │   └── shareMenu.context.ts
    └── hooks/                           # Two hooks, so they get a folder
        ├── shareEmailValidation.hook.ts
        └── shareFolderButton.hook.ts
```

These rules apply inside modules and packages. The layout's fixed folders always exist, even with one thing in them:
`apps/`, `packages/`, each app and package, `src/modules/` and each module.

Both rules run in reverse too. A folder left with one file goes flat again, so the tree never holds a folder it doesn't
need. Reading it from the top shows what is shared (higher up) and what is private (deeper down), without opening a
file.

### A component renders, and its hook holds the logic

A component with state, effects, handlers or queries keeps them in its hook, `<component>.hook.ts`. The hook sits next
to it, or in its `hooks/` folder once it has two. The component calls the hook and renders what it returns. A hook file
holds no JSX.

### A type stays with its only consumer

A type used by exactly one file is declared at the top of that file, right after the imports. That covers its props,
params, response shape and local helper types:

```tsx
// deckPreview.tsx
interface DeckPreviewProps {
  thumbnailUrl: string | null;
  title: string;
}

export const DeckPreview = ({thumbnailUrl, title}: DeckPreviewProps) => {
  // ...
};
```

A type moves to a `.type.ts` once a second file imports it, and that file sits next to the file that declares the code.
For example, `deckPreview.tsx` and `deckPreview.hook.ts` both use the props type, so it goes in
`deckPreview/deckPreview.type.ts`. When the component and its hook each need a different type, each type stays in its
own file.

## camelCase names

Every file and folder name is camelCase in every dotted part: `sessionRow.tsx`, `uploadsPage.useCase.tsx`,
`assetManagement/`, `sharedCore/`. The symbols inside keep their language casing (`SessionRow`, `useSessionRow`,
`MAX_ROWS`).

**The exception is a name that a framework, library or URL fixes.** Examples:

- Next.js's `page.tsx`, `layout.tsx`, `[projectId]/` and `(routeGroup)/`
- route folders, which are URL segments, such as `recently-deleted/`
- config files such as `vite.config.ts`
- a library convention file, such as gt-next's `loadTranslations.ts`

The exception covers only the name the tool or URL fixes. Code that wraps the library still follows these rules. Never
rename such a file for consistency, and prefer the tool's default lookup over custom path config.

## Modules

### A module's shape

```text
src/modules/assetManagement/
├── assetManagement.tsx             # The entry, while one page mounts the module
├── assetManagement.constant.ts     # Constants shared across the module
├── assetManagement.store.ts
├── assetManagement.service.ts
├── upload.hook.ts                  # The module's only shared hook, so no hooks/
├── components/
│   ├── assetCard.tsx
│   └── settingsBar/
│       ├── settingsBar.tsx
│       └── settingsBar.hook.ts
├── modules/                        # Sub-modules, once the feature has distinct areas
└── useCases/                       # Replaces the entry once a second page mounts the module
```

A module has only the files and folders it needs: a small one can hold a single component file.

### `core`

`src/modules/core/` follows the same rules. Besides components, hooks, contexts, stores, services, constants and types,
it holds first-party libraries in `lib/` (an event bus, an analytics wrapper, an API base client) and the app's typed
runtime config. It holds what every feature leans on:

- the app shells
- app-wide stores and contexts
- global hooks (auth, analytics, queries)
- service clients
- route and query-key constants

`core` imports no feature module. That is what keeps a feature deletable: global hooks and services never sit inside a
feature, so no other feature can come to depend on it.

### Imports between modules

- A feature module imports from itself, from `core` and from `packages/*`, and from nothing else.
- When two feature modules need the same thing, it moves up to `core`, or to a package when no app-specific code depends
  on it. Moving it is the fix. Importing it from the other module never is.
- A large feature splits into sub-modules under `<feature>/modules/<area>/`, each following the same rules. A sub-module
  may use its parent's shared files. Sibling sub-modules don't import each other.

## Use cases: one module, many pages

```text
src/modules/assetManagement/
├── components/                          # Shared by every use case
├── hooks/
└── useCases/
    ├── assetManagementPage.useCase.tsx  # Mounted at /assets
    ├── recentlyDeletedPage.useCase.tsx  # Mounted at /assets/recently-deleted
    └── uploadsPage/                     # Mounted at /assets/uploads; it has files of its own
        ├── uploadsPage.useCase.tsx
        └── uploadsPage.hook.ts
```

- A use case composes the module's shared components, hooks and providers, and never copies them.
- A feature that shows up in two places, such as a dashboard and a landing page, is one module with two use cases. It is
  not two components in two places.
- A module mounted on one page uses its entry component. `useCases/` arrives with the second page, by the
  [flat-until-two rule](#one-of-a-kind-sits-flat-two-get-a-folder).

### Route files are thin

The routing tree says where a page is mounted, and the use case says what the page is. A route file imports one use case
and mounts it:

```tsx
// src/app/(dashboard)/assets/page.tsx
import {AssetManagementPage} from "@/modules/assetManagement/useCases/assetManagementPage.useCase";

const Page = () => <AssetManagementPage />;

export default Page;
```

A route file holds that mount, plus the exports its framework asks for, such as metadata and static params. Route groups
and layout files only wire up layouts. An app without a file-based router follows the same split: its entry file mounts
use cases and contains no feature code.

## Promotion ladder

| Used by                   | Lives in                                             |
| ------------------------- | ---------------------------------------------------- |
| One file                  | Inside that file, or next to it in its unit's folder |
| Two siblings              | Their shared parent's level                          |
| Several parts of a module | The module's root                                    |
| Several modules           | `modules/core/`                                      |
| Several apps              | `packages/<kind>/`, or `packages/sharedCore/`        |

The same ladder applies to every role. Promotion is the only refactor this layout ever needs: the shared code moves up
one level, and then the folder rules settle both levels. A building block may give its new level two of a kind and so a
folder, while a cog joins the new level's file of its role. The old level may be left with one file and go flat. Never
promote in advance, on the grounds that it might be reused someday. Wait for the second consumer.

When you move code, update every import of it in the same change.

## No pass-through re-exports

A pass-through file is one whose only job is to re-export a symbol from somewhere else. There are two ways one gets in,
and both are wrong:

- writing one so that a symbol can be reached from a second path
- leaving one behind after a move or rename, so that old imports keep working

Import from the real location at every consumer instead. When a move would break N imports, fix those N imports in the
same change. A shim hides where the code lives and lingers as a dead alias. This holds across apps and packages, and
when porting code from one app to another.

There is one exception: a package's entry file that gathers several exports into its public surface.

## The `packages/*` layer

Each package follows the same rules as a module inside.

- **`services/`** has one package per backend domain (`authService`, `paymentService`). Each holds an API client, and
  validates responses where they enter the app.
- **`schemas/`, `types/` and `constants/`** are the contract between apps. Something belongs here only once more than
  one app uses it.
- **`sharedCore/`** is where `core` code goes once several apps grow it near-identically. It mirrors `core`'s shape.
- **`ui/`** is the design system, in two layers:
  - `components/base/` holds primitives such as button, input, dialog, select and tooltip. Each is a thin wrapper over a
    headless primitive, the class-merge helper and the design tokens.
  - `components/blocks/` holds ready-made compositions, such as a color picker, a date-range picker or a confirm dialog.

  Feature code reaches for a block first, and drops to base primitives only for something custom. A feature-specific
  component never goes in `ui`, because it belongs to its module.

## Placing a new file

Answer these in order:

1. **What role is it?** That picks the suffix: none for a component (`<x>.tsx`), otherwise `.hook.ts`, `.constant.ts`
   and so on. A building block gets a file of its own. A cog joins its owner's file of that role, if it has one.
2. **Who uses it today?** That picks the level, from the [promotion ladder](#promotion-ladder). With one consumer, it
   goes inside that file or next to it.
3. **Is it a page?** Then it is a `<page>.useCase.tsx` in its module, plus a thin route file that mounts it.
4. **Is it a new feature?** Then it gets a new folder, `modules/<feature>/`, holding only what it needs.
5. **Settle the folders.** If its owner now has files of its own, they go in the owner's folder. If its level now holds
   two of its kind, those go in the kind's folder.

To delete a feature, delete its module folder and the route files that mounted its use cases. If anything else breaks,
something leaked out of the module. Fix the leak by promoting the leaked code properly or deleting the dangling import.
Never put the coupling back.

## Enforcing it

Where the repo runs ESLint, most of these rules can be linted instead of left to review:

- **Names:** `unicorn/filename-case` set to `camelCase` checks files. `eslint-plugin-check-file`'s
  `folder-naming-convention` checks folders. Both need the framework and route names exempted.
- **Roles:** `@typescript-eslint/naming-convention`, with one block per suffix. For example, `.hook.ts` exports start
  with `use`, and a `.tsx` file without a role exports a PascalCase component.
- **One block per file:** `react-refresh/only-export-components` flags a component file that exports anything else, and
  `react/no-multi-comp` flags a second component in one file.
- **Imports:** `eslint-plugin-boundaries`, or `import-x/no-restricted-paths` zones. These cover `core` importing a
  feature module, a module importing another module, and a package importing an app.
- **Folders:** a small custom rule can check that a unit's files share its folder, and that a kind's folder holds two or
  more files.

Add a lint for a rule when the team agrees to it, rather than leaving the rule in prose alone.

## Review checklist

Flag any of these:

- [ ] A name that isn't camelCase in every dotted part, other than one a framework, library or URL fixes.
- [ ] A `.ts` file without a role suffix, or a file holding code of another role.
- [ ] Two components, hooks, contexts, providers, stores, layouts, use cases or icons in one file.
- [ ] An `index.ts(x)` file, or a folder that holds a single file, other than the fixed ones.
- [ ] A kind's folder with one file in it, or two files of one kind sitting loose at one level.
- [ ] A unit's own files spread outside its folder.
- [ ] A feature module importing from another feature module.
- [ ] `core` or `sharedCore` importing from a feature module.
- [ ] A package importing from an app, or a generic package importing a domain package.
- [ ] Feature logic in the routing tree instead of a use case.
- [ ] Code placed in `core` or a package with only one consumer.
- [ ] The same code in two modules, where it should have been promoted to the level they share.
- [ ] A type in a `.type.ts` that only one file uses.
- [ ] A component holding its own logic instead of calling its hook.
- [ ] A file that only re-exports a symbol from elsewhere.

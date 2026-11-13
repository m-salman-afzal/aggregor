# Webview

The Sessions view drawn in a webview of our own.

## The webview is a view; nothing leaves its layer

- **Problem:** a webview's React code runs in VS Code's page, apart from the extension, yet draws the extension's DTOs.
- **Decision:**
  - `apps/webview` is the Sessions view's drawing half: React, built into the extension's `dist/webview`, following the
    folder-structure skill rather than `DDD.md`. It imports the extension's `@views/sessions/sessions.view.type.ts` and
    `@dtos` for types only, the rule `DDD.md` already gives a view, and `@pkg/constants` for texts and command ids. Lint
    rejects a value import from the extension, so none of its code enters the webview's bundle.
  - `presentation/views/sessions/sessions.view.ts` is the view: it registers a webview view provider, reads the rows
    through the view's controllers, sends them to the webview with `postMessage`, then each change of
    `watchSessionListChanges` (every project, one project's sessions, or one session) and the session in front.
  - The messages are one tagged union each way, in `sessions.view.type.ts`; the view decodes the webview's with
    `decodeVsCodeArgument`.

  The domain, the DTOs and the controllers stay where `DDD.md` puts them, and the webview sees only what a tree view
  sees.

- **Solution:** VS Code shows a webview view's badge only once the view has been in sight in the window, so until then
  the activity bar shows no count.
- **Alternatives considered:** the DTOs and the value objects they're built from in shared packages, with Effect RPC
  groups decoding them on both sides (it needs their schemas at runtime); a package of the webview's own row types,
  duplicating the DTOs; the webview's code inside `apps/extension`, beside `src/`, under the extension's lint.

## The webview runs the menus' commands

- **Problem:** a click in the webview has to reach a use case.
- **Decision:** the webview asks the view to run a command with the row's node id, the argument a tree menu passes, and
  the view runs it with `executeCommand` when it is one of `SESSIONS_WEBVIEW_COMMANDS` (now Open Session and Add
  Project). Each runs as the menus' do: its route, `registerCommand`'s root span and presenter message, its controller.
  No new controller or layer, and a webview action and a menu item stay one path.
- **Alternatives considered:** RPC handlers calling the controllers; a message per action, each with its own controller.

## The webview is React with shadcn on Base UI

- **Problem:** what the webview is drawn with.
- **Decision:** React 19 with the React Compiler (Babel's, through `@vitejs/plugin-react`'s preset; its Rust port is
  experimental), Vite, Tailwind CSS 4, shadcn's `base-nova` components on Base UI in `modules/core/ui`, and lucide
  icons. Colours are shadcn's tokens set from VS Code's theme variables, so every theme fits; the design is our own. No
  Effect in the webview: a store on React's `useSyncExternalStore` keeps what the view sent, and the projects the user
  folded away in VS Code's webview state. F5 draws the webview from Vite's dev server, so an edit shows without a
  restart (`AGGREGOR_WEBVIEW_DEV_SERVER_URL`, set in `launch.json`); everywhere else it loads the build. Shadcn's
  components are copied in and ours to change, Base UI is maintained, and the webview only draws and sends messages,
  which needs none of Effect.
- **Solution:** shadcn's files keep its kebab-case names and its shape, and lint skips them, so `shadcn add` can update
  them. Their components are arrows, though (see "Components are arrow functions" under webview 0).
- **Alternatives considered:** Radix primitives under shadcn, which the user turned down as no longer maintained; Effect
  Atom for the state; an Effect RPC client.

## A session row has two lines for now

- **Decision:** the first line is the title after its status's icon (colour per status, a spinner while working); the
  second, smaller and muted, the agent's icon and name, the status, or what a blocked agent waits for, the progress and
  the agent's message, cut to fit; the tooltip has them whole with the project's path. The session in front is marked. A
  project's name folds its sessions away. The third line arrives with worktrees, for the branch. The user's hierarchy,
  with the parts that exist today.

## The design system is a package, `@pkg/ui`

- **Decision:** the theme and shadcn's components move from `apps/webview/src/modules/core` to `packages/ui`:
  `src/theme.css` and `src/components/base/` (button, collapsible), with shadcn's `components.json` there, so
  `shadcn add` writes into the package. The webview imports them as `@pkg/ui/src/...`, like the other packages, and
  keeps `cn` for its own components. Replaces "The webview is React with shadcn on Base UI"'s `modules/core/ui`. The
  user's call: the styles and components are one design system, apart from the app that uses it; the folder-structure
  skill's `packages/ui`, with `components/base/` for primitives and `components/blocks/` for compositions once there are
  some.
- **Solution:** How: Tailwind scans only the app it builds, so `theme.css` adds the package's components with `@source`;
  the built `webview.css` came out byte for byte the same as before the move. The skill's one export path per entry
  (`@pkg/ui/button`) gives way to the repo's `@pkg/<package>/src/<file>`.

## The Sessions store listens and asks to be drawn as it loads, in `stores/`

- **Problem:** the host's messages arrive as window `message` events, outside React, and several rows read parts of
  them; the view also had to ask the host to draw once it listened, which took a `useEffect`.
- **Decision:** a store of our own on `useSyncExternalStore`: it starts listening when its file first loads, before the
  view mounts, and asks the host to draw right after, so nothing is missed and no effect waits for a mount. A row
  selects only its part (whether it is in front, whether its project is folded) and draws again only when that changes.
  The store saves the folded projects and the session in front to VS Code's webview state. It lives in the module's
  `stores/` folder, even alone, with its pure helpers and types beside it.
- **Solution:** `modules/sessions/stores/sessions/`: `sessions.store.ts` (`useSessionsStore`, its state and what changes
  it), `sessions.utils.ts` (one reducer per host message, row replacement, folding) and `sessions.type.ts`.
  `aggregor/kind-folder` lets `stores/` hold one store.
- **Alternatives considered:** plain React state, `useReducer` in the view's hook with the listener in a `useEffect` and
  the parts passed down as props, which the React Compiler would keep cheap but which needs effects to listen and to ask
  the host to draw; a store library, which the one store doesn't need.

# Webview

The Sessions view drawn in a webview of our own.

## The webview is a view; nothing leaves its layer

- **Problem:** a webview's React code runs in VS Code's page, apart from the extension, yet draws the extension's DTOs.
- **Decision:**
  - `apps/webview` is the Sessions view's drawing half: React, built into the extension's `dist/webview`, following the
    folder-structure skill rather than `DDD.md`. It imports the extension's `@/views/sessions/sessions.view.type.ts` and
    `@/dtos` for types only, the rule `DDD.md` already gives a view, and `@pkg/constants` for texts and command ids.
    Lint rejects a value import from the extension, so none of its code enters the webview's bundle.
  - `presentation/views/sessions/` is the view, a file per job. `sessions.view.ts` registers the webview view provider,
    answers the webview's messages and watches what changes. `sessionsDrawing.utils.ts` is everything sent to the
    webview with `postMessage`: each list, read whole through one controller, then each change of
    `watchSessionListChanges` (every project, one project's sessions, or one session), the session in front, the counts,
    the installed agents and the look. `sessionsPage.utils.ts` writes the page and makes the agent icons' webview URIs.
  - The messages are one tagged union each way, in `sessions.view.type.ts`; the view decodes the webview's with
    `VscodeUtils`'s `decodeVsCodeArgument`.

  The domain, the DTOs and the controllers stay where `DDD.md` puts them, and the webview sees only what a tree view
  sees.

- **Solution:** VS Code shows a webview view's badge only once the view has been in sight in the window, so until then
  the activity bar shows no count.
- **Alternatives considered:** the DTOs and the value objects they're built from in shared packages, with Effect RPC
  groups decoding them on both sides (it needs their schemas at runtime); a package of the webview's own row types,
  duplicating the DTOs; the webview's code inside `apps/extension`, beside `src/`, under the extension's lint.

## The webview runs the menus' commands

- **Problem:** a click in the webview has to reach a use case.
- **Decision:** the webview asks the view to run a command with the row's key as the request DTO's own field,
  `{sessionId}` or `{projectPath}`, and the view runs it with `executeCommand` when it is one of
  `SESSIONS_WEBVIEW_COMMANDS`, every command a row's or a list's menu offers, Open Session and Add Project. Each runs as
  the menus' do: the registration its controller made, `registerCommand`'s root span and error message, and the
  controller, which decodes the argument straight into the request DTO. No new controller or layer, and a webview action
  and a menu item stay one path.
- **Solution:** the webview is a page in another process, so it can't call a controller itself; it can only post a
  message, and the view is the extension's end of that.
- **Alternatives considered:** RPC handlers calling the controllers; a message per action, each with its own controller;
  the row's node id (`project:<path>`, `session:<id>`) as the argument, as the tree's menus passed it, which every
  controller had to take apart again.

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
- **Solution:** shadcn's files keep its kebab-case names and its shape, and lint checks them only for arrow components,
  so `shadcn add` can update them. Their components are arrows (see "Components are arrow functions" in
  `conventions/lint.md`).
- **Alternatives considered:** Radix primitives under shadcn, which the user turned down as no longer maintained; Effect
  Atom for the state; an Effect RPC client.

## A session row has two lines, and a project counts its sessions

- **Decision:** the first line is the title after its status's icon (colour per status, a spinner while working), then
  what the agent says it is doing (its progress and message), smaller and muted, taking only the room the title leaves
  and cut to fit, so it reads as secondary to the title; the second line the agent's icon, 18px so agents tell apart at
  a glance (its name in the icon's tooltip), then the pull request, the diff counts and last the worktree's branch,
  which alone is cut to fit, so the hover buttons over the row's end hide only the branch's end, which its tooltip holds
  whole. No status word, since the icon says it; the tooltip has the status and message whole with the project's path.
  The session in front stands out: its title in the strongest text and its row shaded, while every other row's title and
  agent icon are faded until the row is hovered. A status's icon keeps its colour either way, since it is the signal. A
  project's name, which folds its sessions away, ends with a muted count of its sessions in that list.
- **Alternatives considered:** the progress and message on the second line after the branch and diff counts, which
  crowded that line; dropping them from the row, which hides what a working agent is doing; a third line for the branch;
  the agent's name and the status in words on the second line, which repeat the icons; a 12px agent icon, too small to
  see; every row at full strength, which gave the session in front nothing to stand out from; the branch before the pull
  request and diff counts, where a long branch pushed them under the hover buttons; hover buttons over the first line
  only, which sit off the row's centre.

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

## The Sessions list fills the view, and the Archive is a drawer at its bottom

- **Problem:** the Archive was a tree view of its own, and then a second list at the same level as Sessions, each
  folding under its own header, so folding the Archive moved it up under Sessions and neither read as the main list.
- **Decision:** the Sessions list fills the view and doesn't fold: a quiet title with its buttons, then its projects,
  which scroll on their own. The Archive is a drawer docked at the view's bottom. Its header is its name, an arrow and a
  line across the view, which become a box while hovered, when its … button shows too; folded, only that shows; open,
  the Archive slides up under it to 40% of the view's height and scrolls. Each header shows how many of its sessions
  wait on the user as a small badge in the waiting colour. The Archive starts folded, and its fold, like each project's
  in each list, is kept in the webview's state. The Archive tree view, its badge provider, spinner and constants are
  deleted.
- **Solution:** the view sends `ArchiveDrawn` with the Archive's rows on every change but a session's own,
  `SessionDrawn` for a session in either list, and `WaitingCountsDrawn` with each list's count whenever the badge
  changes. `mainList.tsx` and `archiveDock.tsx` draw the two around the same project rows. An empty Archive says how
  sessions get there.
- **Alternatives considered:** two lists at one level, each folding (built first); an Archive header as a bar from edge
  to edge, which read as a second title bar; keeping the Archive tree beside the webview; a second webview view; an
  Archive that resizes by dragging, left until it is missed.

## The session in front stays marked

- **Problem:** the row of the session the editor shows has to stay findable while the user clicks around the view.
- **Decision:** the row of the session whose tab is in front (`viewedSessionId`) is marked (`aria-current`, the list's
  inactive selection colour) in whichever list holds it, and stays marked when the window loses focus or no session's
  tab is in front; clicking another row marks it at once and opens that session. Like Explorer for the active file, the
  mark says which session the editor shows, and a click shows without waiting for the window to switch project.
- **Solution:** the view sends `ViewedSessionChanged` whenever the session in front changes, and the webview keeps the
  last one in its state, so a reloaded page marks it again. A click marks its row in the store (`markViewedSession`)
  before it asks the host to open the session; the host's next `ViewedSessionChanged` overrides it, so a session that
  fails to open stays marked until another tab comes to the front.
- **Alternatives considered:** the tree's selection, which any click moved off the session and which needed a reveal
  retried while a new row was drawn; marking a clicked row only once the host reports its tab in front, which lagged
  behind clicks while the window switched projects.

## The view looks its own way: soft, rounded and floating

- **Problem:** drawn as close to VS Code's tree as it could be, the view was dense: small, faint buttons with no hover
  state, flat rows edge to edge, thin icons, and status words repeating the icons.
- **Decision:** the view takes its colours and font from the theme but draws its own shapes, as T3 Code's side bar does,
  without copying it. A row is rounded and sits inside the view's sides. Buttons are larger, their icons muted until
  hovered; a list's header's are larger still and always shown. lucide's strokes are heavier (2.25). Counts are small
  rounded badges. What should stand out is drawn in a stronger text than the theme's own: a dialog's title, a choice's
  name, the session in front, a highlighted menu item. Menus and dialogs sit a step above the view, with rounder
  corners, an edge and a shadow; a dialog opens over a dark, blurred view, with an edge and a soft glow in the theme's
  colour. Scrollbars are thin pills without a track or arrows, shown only while the pointer is in what they scroll. The
  text is 14px by default and is a setting.
- **Solution:** the row and button classes are `rowActions.constant.ts`'s, the popups' in `@pkg/ui`'s menu and dialog
  components, and the colours `@pkg/ui`'s `theme.css`, all mixed from the theme's own: `--foreground-strong` is the
  theme's text pushed toward white on a dark theme and black on a light one, and `scrollbar-minimal` the scrollbar,
  which first undoes the `scrollbar-color` VS Code gives every webview.
- **Alternatives considered:** VS Code's list colours and 22px rows, which the user found tiring; a theme of our own,
  which would clash with the user's; the theme's text colour everywhere and status colours eased toward it, which left
  dialogs and titles without contrast.

## Every shade is a whole level, and each state is one level up

- **Problem:** hover shades were too faint to see, some buttons (an agent's Set as Default) had no resting look at all,
  and once they had one, the shades were mixed by hand, each with its own share of the colour: a button resting on the
  selected row was almost the row's own shade, while a hovered one jumped far past it, so states that met ran together
  or apart with no order to them.
- **Decision:** every shade in the view is a whole level. Level 0 is the view's background, and level n is n equal steps
  from it toward the accent's shade (see "The accent is a setting"). A state is always one level up. A row, a session's,
  a project's and the Archive's header, and a menu's items rest flat, at the level of what they sit on, since a list
  already says its rows can be clicked; hovered, a row is a level higher, and the session in front two, hovered or not,
  behind a short bar in the accent's two colours. A button rests a level above whatever it sits on, so it reads as
  clickable before the pointer reaches it, is hovered two above and open, its menu showing, three. A menu or a dialog is
  a surface at level 1, and a dialog's choices rest at 2 and are hovered at 3. A dropdown a dialog's choice opens sits a
  step below the dialog, at level 0, with a deep shadow and the accent's ring; its items rest flat and are highlighted
  at 1, and its choice stays at 3 while open. While it is open the rest of the dialog dims and blurs, as the view does
  behind a dialog, so only the field that opened it and its list stay in focus. So on the session in front, at level 2,
  a button rests at 3, is hovered at 4 and open at 5, and no two states that meet share a shade. A hovered or open
  button's icon is the strong text colour, which reads on every level a button reaches. Pressing shows nothing of its
  own, since a shade that lasts only while the button is down reads as a flash; and a list's header doesn't light up
  while one of its buttons is used. An action that removes something is red, in a menu and in a dialog. A project with
  no sessions keeps no space for them, so folding it moves nothing.
- **Solution:** `theme.css` holds the one step, `--level-step` (10%), mixed in oklab so each step looks the same size on
  a dark theme and a light one. `bg-level` paints a surface at its own `--level`, which a surface sets with
  `[--level:n]`, and `bg-lift-1` to `bg-lift-3` paint what sits on it one to three levels higher; all four are solid, so
  a row's buttons can sit over its text. shadcn's `--popover` is level 1 and its `--accent` and `--muted` level 2, so
  its components follow; the button's `soft` variant is the three lifts, and its `destructive` one is the red.
  `RowAction.isDestructive` marks Remove and Remove Project. The dialog's dimming is one rule in `theme.css`, on
  `:has()` of an open combobox trigger, so every dialog gets it. No class uses `active:`; a header row's surface
  (`HEADER_SURFACE`) has no hover shade. A project's session list is `empty:hidden`.
- **Alternatives considered:** a shade per state, each its own mix (solid ones for rows, translucent tints for buttons
  and choices), built first, whose steps came out uneven wherever a tint lay over a shade; shades mixed in sRGB, where
  equal shares give a large first step on a dark theme and small ones after; the accent's colour for a hovered button's
  icon, which faded into the higher levels; a resting shade on every session, cards hung on a guide line under their
  project, which the user found heavy; VS Code's own list hover colour, too faint in most themes; a pressed step, darker
  while the pointer is down, which flashed.

## The accent is a setting: neutral by default, or the theme's badge, its terminal palette, or a colour

- **Problem:** shades and accents mixed from the theme's text colour, with VS Code's link blue for accents, came out
  grey with an off-palette blue in a theme like Dracula; the theme's badge colour, tried next, tinted every shade with
  it, which with a green badge (Peacock's) made the whole view green.
- **Decision:** `aggregorApp.accentColor` picks the view's accent. `neutral`, the default, keeps hover and selection
  shades grey, from the theme's text colour, and puts colour only in small marks: the focus border's colour for focus
  rings, the main button, the session in front's bar, a highlighted menu item's icon. `theme` is the activity bar
  badge's colour (Dracula's pink, Peacock's chosen colour), `palette` the theme's terminal blue (Dracula's purple), and
  a `#rrggbb` any colour; each of those also tints the shades. The second colour, for what informs rather than acts (a
  dialog's icon, a badge such as an agent's "default", the far end of the bar's gradient), is always the terminal blue.
  A status's icon is drawn in the theme's terminal colours, the palette its agents' terminals already use. Menus and
  dialogs sit a level above the view (see "Every shade is a whole level").
- **Solution:** the view sends the setting with `AppearanceDrawn`, beside the text size, checked against
  `SESSIONS_VIEW_SETTINGS.ACCENT_COLOR_PATTERN`. The webview draws the look as markup and leaves the rest to CSS: its
  root element carries the accent's name in `data-accent` (`custom` for a colour), and `theme.css` maps each name with
  `:root:has([data-accent="…"])` to `--aggregor-accent` and `--aggregor-shade`, which it reads as `--brand` and
  `--shade`; `--primary` and `--ring` are the brand. A colour of the user's own and the text size can't be rules written
  ahead, and `:has()` can't carry a value up to the root, where rem and the menus' portals read it, so the app renders a
  `<style>` that sets the two on `:root`. The built page's content security policy lets that `<style>` in by the page's
  nonce, which the page also gives in `<meta property="csp-nonce">`, Vite's own convention, for the webview to read.
  Both colours keep their hue but are held to a lightness that shows against the background, light on a dark theme and
  dark on a light one (`oklch(from …)`), since a colour can be as dark as the background itself, as Peacock's greens
  are. Text on the brand is near black or near white by the brand's own lightness.
- **Alternatives considered:** the badge colour for everything, built first, which the user found too green with a green
  badge; the badge colour as the theme gives it, whose shades disappeared when it was dark on a dark theme; the theme's
  list hover and selection colours, too faint in the default themes; its button colours, which Dracula keeps grey; its
  link colour, off-palette in themes that don't set it; a palette of our own, which would clash with the user's theme.
  For how the look reaches CSS: the store setting the three variables on `document.documentElement.style`, built first,
  which put drawing in a store's side effect; the view writing them into the page it builds, which reloads the page each
  time either setting changes.

## Things move: fades for everyone, sliding and growing unless the user asked for less motion

- **Problem:** rows, menus, dialogs and folding lists changed in one frame, which read as abrupt.
- **Decision:** colours and opacity ease over 150 ms everywhere: a row's shade, its buttons fading in, a menu's or a
  dialog's fade, the blur behind a dialog. Movement, a list folding by height, a menu or dialog growing from 95%, a
  chevron turning, the working spinner, runs only when neither the system nor VS Code's Reduce Motion asks for less;
  then things still fade, and the spinner stands still in its colour. A row's buttons are always shown where there is no
  pointer to hover with.
- **Solution:** a `motion-ok` variant in `theme.css` (`prefers-reduced-motion: no-preference`, and no
  `vscode-reduce-motion` on the body) gates the movement. Popups and folding panels use Base UI's `data-starting-style`
  and `data-ending-style` with CSS transitions, and a folding panel's height is Base UI's `--collapsible-panel-height`;
  shadcn's `tw-animate-css` classes are taken out of its components, since the package isn't installed. A folding panel
  clips while it moves, so focus rings inside it are drawn inset.
- **Alternatives considered:** `tw-animate-css`, shadcn's default, a dependency for a few keyframes that would still
  need the reduced-motion gate; turning every animation off at once with a near-zero duration, which can make some more
  jarring and drops the fades too.

## The text size is a setting, and everything scales with it

- **Problem:** the view's text was small, and users differ in what they read comfortably.
- **Decision:** `aggregorApp.fontSize` (10 to 24 pixels, default 14) sets the view's text size; spacing, buttons and
  icons scale with it. The view reads the setting itself, as a display preference, and sends it with `AppearanceDrawn`
  first when the page asks to be drawn and again whenever it changes.
- **Solution:** the webview renders `--aggregor-font-size` in its `<style>` (see the accent's entry), and `theme.css`
  sizes the root so the body's text, `0.875rem`, is that size, which every rem follows.
- **Alternatives considered:** VS Code's own font size, which is the editor's; reading the setting through a controller
  and a settings service, for a value no use case needs.

## The view's name is Aggregor

- **Problem:** VS Code's header read `AGGREGOR: SESSIONS (2)`, repeating the list's name and count above it.
- **Decision:** the view is named Aggregor, the container's name, so VS Code's header reads `AGGREGOR` alone; the
  waiting count sits on the Sessions list's title and on the activity bar's badge.
- **Alternatives considered:** the view's name with the count, as before.

## A session's tasks open in a dropdown under its row

- **Problem:** a session's agent can run sub-agents and background shells that the row's one status hides, and the
  processes it starts (the next steps) need a place too.
- **Decision:** a chevron in a box of its own, drawn and lit on hover as the row's other buttons are, under the row's
  status icon, on its second line, opens a panel under the row, inside its list item, with a Tasks section: each task's
  status icon, an icon for what it is (a sub-agent, a background shell, a remote agent, a teammate, a workflow, a
  monitor, an MCP task, or other), its title (or its id when it has none), and its progress and message. The chevron
  shows while the session's agent runs, since its terminal always has processes to show (see "A session's terminal
  processes show in its dropdown"). Which sessions have it open is kept with the folds, in the webview's state, so a
  reload keeps them open.
- **Solution:** the session list item carries `tasks` as `SessionTaskDto`s, built by `SessionService` from the row's
  `tasks` column. `getAgentTaskKind` reads a task's kind from its id's first letter, Claude Code's own table (`a`
  sub-agent, `b` shell, `r` remote agent, `t` teammate, `w` workflow, `m` and `s` monitors, `k` MCP task), since OSC
  7501 carries no kind for a task; an id it doesn't list, or a change in Claude's ids, shows the other icon.
  `getSessionTasks` drops a task whose title is the one the agent reports for itself: OpenCode (2.3.2) reports its own
  conversation again as a task, under an id of its own (`ses_…`, not the one Aggregor starts it with). The row is a
  `Collapsible` rendered as its `<li>`; `sessionDropdownToggle.tsx` is its trigger, the design system's soft icon
  `Button`, beside the row's own button since a button can't hold one, and `sessionDropdown/` its panel, which folds
  with the projects' `COLLAPSIBLE_PANEL` and draws its sections from `components/sessionTaskList/` and
  `components/terminalProcessList/`. The row's open button moved into `sessionOpenButton/` with its hook, the title and
  detail lines it draws and their constants, keeping the row and its hook short. The store keeps
  `openDropdownSessionIds`.
- **Alternatives considered:** dropping a task whose id holds the session's conversation id, which OpenCode's echo
  doesn't; dropping OpenCode's `ses_` ids, one agent's id format in the domain; the kind read only for the Claude agent,
  which its settings key can't tell apart; storing the report's `app` with each task, a pty and column change while
  Claude is the only agent that reports tasks; a popover beside the row, which covers the rows under it and closes on
  the first click elsewhere; the chevron in the row's left gutter, which crowds the brand bar of the row in front; the
  chevron inside the row's text, which nests a button in a button; the chevron only while the session has tasks, which
  hid every other agent's terminal; the bare chevron (built first), a 16-pixel target with no edge to aim at.

## A session's terminal processes show in its dropdown

- **Problem:** a session's tasks are what its agent reports, and only Claude Code reports any; what runs in the agent's
  terminal (its shells, dev servers, MCP servers, browsers) showed nowhere, for any agent.
- **Decision:** the dropdown has an Agent terminal section: every process the agent's tmux session runs, by name, as a
  tree by parent, with its command line in its tooltip. The names are plain words; the section's header carries the
  session's agent icon, and the section and every process with children fold, each closed at first, so the dropdown
  opens as one line per terminal and the user unfolds only the level they want. On Linux a pane in a systemd scope of
  its own brings in its whole cgroup, so a process that left the agent's tree (a detached Chrome) still shows; a pane in
  the tmux server's cgroup, as without a systemd user manager, and every pane elsewhere, as on macOS, brings in its own
  tree. The list is read every 2 seconds, only for the dropdowns open in the webview for running agents, and lives in
  memory: it reaches the webview as messages and is never stored. Each process's CPU and memory are left for later
  (issue #204).
- **Solution:** the store sends `WatchSessionProcesses` with the open dropdowns of running sessions whenever that list
  changes; `SessionsView` keeps it in a `SubscriptionRef`, empties it when the webview is disposed, and draws each
  `SessionProcessesDto` that `SessionProcessService.watchSessionProcesses` streams, which switches to each new list and
  reads it with `Schedule.spaced(PROCESS_SAMPLING.INTERVAL)`, untraced, as the database poll is. `ITmuxInfraService`
  reads a session's panes (`list-panes -s -F '#{pane_pid} #{pid}'`) and the new `IProcessInfraService`
  (`infrastructure/services/process/`) lists their processes: one `ps -A -o pid=,ppid=,command=`, and on Linux each
  pane's `/proc/<pid>/cgroup` and its cgroup's `cgroup.procs`. `TerminalProcessList` takes its header's icon, and each
  fold is a base-ui `Collapsible` kept by the process id across readings. The store keeps each session's latest list
  until its dropdown closes.
- **Alternatives considered:** each process's CPU and memory, with the terminal's totals, built and then put off as more
  than the list needs now (issue #204); storing the list in the database, which every 2 seconds would churn it and its
  change feed; reading every running session all the time; the processes of the agent's tree alone on Linux, which
  misses what detached from it; an icon and a colour per process, by kind, read from a hand-kept list of program names
  that would go stale; every fold open at first (built first), which drew every terminal's whole tree as soon as the
  dropdown opened.

## A session's folder shell shows in its dropdown too

- **Problem:** what a user starts in the session's folder shell, the Aggregor terminal's shell (a dev server, a test
  watcher), belongs to the session as much as what its agent starts, and showed nowhere.
- **Decision:** under the Agent terminal section, a section for the session's folder shell, labelled as the shell's
  status line is ("jsTester", or "jsTester · worktree-name"), under a terminal icon, with the same tree of names. A
  shell is shared, by a project's root sessions or by one worktree's, so it shows under every session that uses it, with
  "Shared by N sessions" when N is more than one, counting the folder's sessions in the Sessions list and the session
  itself. A shell that isn't running hides its section.
- **Solution:** `SessionProcessService` finds the session's shell with `prepareSessionFolderShellRequest`, now exported
  from `folderShell.service.ts`, and reads its panes with `ITmuxInfraService.readFolderShellPanes`, its processes as the
  agent terminal's; `SessionProcessesDto` carries the optional `FolderShellProcessesDto`.
- **Alternatives considered:** the shell under its project's header, which has no place for a worktree's shell; counting
  the folder's archived sessions too, 14 on a busy project, most of them out of sight; counting only the sessions whose
  agent runs, while a stopped session still opens the same shell.

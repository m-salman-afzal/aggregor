# Terminals

Where a session's agent runs, its tab, and resuming it.

## Clicking a closed session resumes it

- **Decision:** when tmux no longer runs the session's agent, opening it starts the agent again: the domain's
  `prepareLaunchPlan` takes the agent's `resumeArgs` (`claude --resume ‹id›`) once the session has reported `working`,
  else its `args`, which start fresh under the session's id where the agent takes one. While tmux still runs it, opening
  only attaches. An agent has a conversation to resume once it has worked, and the flag is the same for every agent.
- **Alternatives considered:** looking for Claude's transcript file, which only Claude has. `aggregor-pty` reading
  `hasWorked` as it starts and picking between the two argument lists it was given, while VS Code restored session tabs
  after a quit by re-running the command they were opened with, which the extension never saw; since session tabs are
  transient, every tab is opened by the extension, so the pick went back to it.

## A session's tab shows its row's name

- **Problem:** session tabs opened without a name to show the agent's own title, but VS Code 1.145 shows a terminal's
  title in its tab only for the agent CLIs it recognizes (Claude Code, Codex, Copilot, Gemini), by process name or title
  text. Under `aggregor-pty` only Claude and Copilot are recognized, by their titles, and every other tab showed
  `aggregor-pty`.
- **Decision:** a session's tab opens with the session's `displayName` and `startSessionTabNameSync` keeps it there:
  after any write to a session, whenever a session's tab becomes the active terminal and when the shared tab switches
  session, the active tab is renamed if its name differs. VS Code renames only the active terminal, so a tab in the
  background takes a new name when it next comes to the front. Rename from the row menu no longer brings the tab to the
  front, and an empty name hands the tab back to the agent's title at once. The row and the tab say the same thing for
  every agent, from the one name in the database. Claude's and Copilot's tabs lose their live marks (✳, the spinner);
  the row's badge shows the status.
- **Alternatives considered:** `aggregor-pty` writing the session's name as the terminal title, with the window showing
  terminal titles in tabs: background tabs follow too, but every terminal tab in the window, shells included, would
  change. The extension hosting the terminal as a Pseudoterminal, which can rename any tab: all agent output would pass
  through the extension host, and the tmux attach would change. `titleTemplate`, a proposed API the Marketplace refuses.

## One shared tab shows the session opened last, switching in place

- **Problem:** every session opens in a tab of its own, so a user who switches sessions from the Sessions view ends up
  with a row of session tabs beside their files. Replacing the tab on each switch made the tab bar jump three times a
  click: a tab opened, was pinned, and the old one closed.
- **Decision:** `aggregorApp.openSessionIn` picks between `ownTab` (the default, a tab per session) and `sharedTab`,
  where one tab stays and tmux attaches its client to the session opened (`switch-client`). No tab opens or closes, so
  the tab keeps its place and its pin, and only its name changes. It holds after every open through Aggregor; switching
  tabs by hand changes nothing. A session whose agent isn't running still opens a new tab, which takes the place of the
  shared one, since an agent has to start under an attached client (see "Every session's agent runs in tmux"). The
  shared tab carries Aggregor's icon: it shows sessions of any agent, and a tab's icon can't change once it is open.
- **Solution:** `SessionService.showSessionInSharedTab` asks `ITerminalInfraService` for the open session tab's process
  id, which is its tmux client's, since `systemd-run --scope` runs tmux in place. `ITmuxInfraService.showSessionInTab`
  finds that client in `list-clients` and runs `switch-client -E -c ‹client› -t =‹sessionId›`; `-E` keeps the tab's own
  variables, the id of the session it opened with among them, out of the session it now shows.
  `SessionService.syncSessionTabsWithTmux` then reads from tmux which session each tab's client shows, and
  `assignShownSessions` re-keys the tabs by it, so two quick clicks end on what tmux shows. The same sync runs when the
  extension starts, before the background jobs read the session in view: a tab's `AGGREGOR_SESSION_ID` names only the
  session it opened with, and the extension can restart under open tabs. When the switch fails (the agent has stopped,
  or no session tab is open), the session opens a tab as under `ownTab`, in the editor group in focus, and
  `closeOtherSessionTerminals` closes the others once it is open, so it takes the place of the one in front. With
  several session tabs open, as right after the setting changes, the first one is kept and the rest close. A tab opened
  under `ownTab` keeps its agent's icon when it becomes the shared one. A switch takes about 55 ms.
- **Alternatives considered:** closing every other session's tab once the new one is open (built first): VS Code can't
  swap a tab's terminal, open a tab pinned or batch tab changes, so every switch showed all three steps. A boolean
  `reuseSessionTab`, which says less than two named places. Closing the other tabs whenever a session's tab comes to the
  front: a background job, and tabs the user switches between by hand would close. `TerminalInfraService` asking
  `ITmuxInfraService` itself: the two adapters stay apart, and the use case hands the tab's process id from one to the
  other. Re-keying the tab to the clicked session without asking tmux: two clicks whose switches and re-keys interleave
  leave the tab under the wrong session. Keeping which session a tab shows in `workspaceState`: a second copy of what
  tmux knows, and gone when the window turns into a workspace. VS Code's change-icon command, which only opens its
  picker. Finding the old tab's editor group by its label for the new tab, since a tab does not say which terminal it
  holds. Drawing the terminal in a webview tab (xterm.js), whose name and icon can change: a terminal emulator of our
  own, with all agent output through the extension host.

## A session's tab can be pinned as it opens

- **Problem:** VS Code's API can't pin a tab or open one pinned; `Tab.isPinned` can only be read.
- **Decision:** `aggregorApp.pinSessionTabs` (off by default, in both `openSessionIn` places) pins a session's tab once,
  when Aggregor opens it, with `workbench.action.pinEditor`, the command behind **View: Pin Editor**. An extension can't
  press the shortcut, and the command works whatever key it is bound to. A tab the user unpins stays unpinned until it
  opens again, and tabs open before the setting was turned on stay as they are; the shared tab is pinned when it opens
  and keeps its pin through every switch.
- **Solution:** the command pins the tab in front, and a tab comes to the front a moment after it is shown, so
  `pinSessionTab` (`terminal.utils.ts`) first waits, every 50 ms for up to 5 s (`SESSION_TAB_PIN_WAIT`), until the
  active tab is a terminal tab labelled with the terminal's name and the terminal is the active one; run sooner, the
  command would pin the file the user was on. A tab does not say which terminal it holds, so its label and the active
  terminal stand in for that, and between two sessions of the same name the wait can settle on the other's tab. A tab is
  in front, and pinned, about 100 ms after it opens; after 5 s it stays unpinned, and the trace shows the failed checks.
  VS Code keeps Ctrl+W from closing a pinned tab by default (`workbench.editor.preventPinnedEditorClose`); disposing its
  terminal still closes it, so Remove, Archive and a new shared tab close a pinned tab.
- **Alternatives considered:** pinning whenever a session's tab comes to the front: a background job that would pin
  again a tab the user unpinned. A third `openSessionIn` value, `pinnedSharedTab`, which leaves own tabs without a pin.
  Waiting on `viewedSessionId`, which names a session only while the window has focus.

## Every session's agent runs in tmux

- **Problem:** a session's agent ran as its tab's process, so a window reload, quitting VS Code or closing the tab ended
  it, and the tabs were transient, so a reload closed them.
- **Decision:**
  - Each session's agent runs under `aggregor-pty` in a tmux session named by the session's id, on Aggregor's own tmux
    server, whose socket is `tmux.sock` in the Aggregor folder (`-S`), apart from the user's tmux; a test's
    `AGGREGOR_HOME` gets a server of its own. `assets/tmux.conf` replaces `~/.tmux.conf`: no prefix or status bar, mouse
    on, `escape-time 0`, `focus-events`, `extended-keys`, a 50,000-line history, `window-size latest`,
    `aggressive-resize`, 24-bit colour and OSC 52, and `update-environment` for VS Code's terminal variables and the
    session's `AGGREGOR_SESSION_ID`. A window sources it again when tmux already runs. tmux 3.2 or newer is required.
  - A session's tab runs tmux itself, with no shell:
    `tmux -S ‹socket› -f ‹conf› -u new-session -A -s ‹id› -c ‹project› -- aggregor-pty --database ‹db› --session ‹id› -- ‹command› ‹args›`.
    `-A` attaches when the session's tmux session runs and starts it otherwise, so the tab is attached from the agent's
    first byte, tmux answers its colour queries, and the agent gets the tab's own environment.
  - The tab is transient: a reload or a quit closes it, which only detaches, and clicking the session attaches a new
    one. A tab is matched to its session by `AGGREGOR_SESSION_ID` in its env, which VS Code keeps through an extension
    restart, and then by the session its tmux client shows, which the shared tab changes. Tabs VS Code kept over a
    reload and restored after a quit by re-running their command (found by their command line through `ps`) lost their
    icon: VS Code 1.145 revives a reattached tab's file icon as plain data, fails its `instanceof URI` check and draws
    none, and has no API to set it again. An icon font (`contributes.icons`) survives a reload but, per
    microsoft/vscode#329750, not a restart, and closing and reopening every restored tab at start reorders and flickers
    them.
  - When `aggregor-pty` can't start the agent (a command it can't run), it prints why and waits for Enter, so the tab
    doesn't vanish without a word.
  - tmux learns the tab's colours about 20 ms after the tab attaches and leaves a colour query unanswered until then.
    `aggregor-pty` asking for the background every 20 ms until tmux answered, and only then starting the agent, gave
    Codex's composer the theme's shade in a headless check (`52,53,54` instead of `25,26,27`), but was dropped the same
    day: Codex looked right without it in use, and it held back every agent's start.
  - `ITmuxInfraService` builds the tab's command after checking tmux and `aggregor-pty`, lists and stops sessions, and
    after a tab opens reads tmux's list until it has the session (every 50 ms, up to 5 s); `TerminalInfraService` only
    opens, focuses, names and closes tabs. A row's exited status comes from tmux's session list, read when the window
    starts or regains focus, when a terminal closes, after a session's tab opens and after each stop; it isn't written
    to the database, so the status column keeps one writer.
  - Remove Session asks first while the agent runs, then kills its tmux session and closes its tab.
  - tmux missing or too old fails a start with an error whose **Install** runs the system's package manager in a
    terminal (see [requiredTools.md](requiredTools.md)).
  - `extensionKind: ["workspace"]`, so in a WSL or remote window the extension, tmux and the agents run there.

  An agent outlives its tab, a reload and VS Code, sees the terminal's real colours and VS Code's terminal environment,
  and every tab is one the extension opened, so it starts or resumes the right conversation.

- **Solution:** tmux sets `TERM_PROGRAM=tmux` inside its sessions, so agents see tmux rather than `vscode`. A reload or
  a restart closes the session tabs, and their order and layout with them; the agents keep running. An agent that exits
  at once, such as a resume whose conversation is gone, closes its tab without a word; only `aggregor-pty`'s own
  failures wait for Enter. Explainer: [Aggregor's Terminal Stack](https://claude.ai/artifact/61wbTDjGVEkccHKKGT8GiS), a
  30-second film of a session's three ptys (the tab's, tmux's pane, the agent's): a key going in, output and status
  coming back, VS Code closing and the tab reattaching.
- **Alternatives considered:**
  - The extension starting each agent from a hidden, transient VS Code terminal running `tmux new-session -d …`, with
    the tab only attaching (built and tried): the agent started with no tmux client attached, and tmux answers an
    agent's OSC 10/11 colour queries only through an attached client, so agents that ask for the background as they
    start (Codex, OpenCode, Copilot, Claude) picked palettes that didn't match the theme. Each start also waited about
    400 ms for the hidden terminal's exit, polled.
  - The extension starting tmux as its own child process: the agent would inherit the extension host's environment,
    without what VS Code gives terminals (the git extension's `GIT_ASKPASS` and `VSCODE_GIT_IPC_HANDLE`, which another
    extension can't read) and with VS Code's internals (`ELECTRON_RUN_AS_NODE=1`).
  - One tmux client for every tab, through tmux control mode (`-CC`), with the extension drawing each tab as a
    Pseudoterminal: one process instead of a small tmux client (about 1.4 MB) per open tab, but all agent output would
    pass through the extension host, and tabs would no longer survive a reload by themselves.
  - Bundling tmux in the VSIX: it means shipping and patching tmux, and macOS has no fully static build. The README's M5
    plans to bundle it after all, with libevent and ncurses linked in.

## Each agent runs in a systemd scope of its own, and goes first when memory runs out

- **Problem:** the tmux server stays in the cgroup of the process that starts it, the first session tab, which is VS
  Code's (`app-com.microsoft.VSCode-‹pid›.scope`). Every agent and everything it started counted as VS Code's memory,
  and systemd-oomd kills a whole cgroup: one agent's runaway dev server killed VS Code, tmux and every other agent.
- **Decision:** on Linux with a systemd user manager, a session's tab runs
  `systemd-run --user --scope --quiet --collect -- tmux …`, so the tmux server lands in a scope of its own, and inside
  tmux each agent runs as `systemd-run … -- aggregor-pty …`, its setup script included, in a scope of its own. An
  out-of-memory kill then takes that one session. `aggregorApp.sessionMemoryLimit` (empty by default) sets the scope's
  `MemoryMax`, a size such as `8G` or a share such as `25%`, read when an agent starts; over it, the kernel kills that
  session alone. The scopes are named by systemd, so a leftover scope never blocks a start. On every Linux, systemd or
  not (WSL without systemd, a container), `aggregor-pty` raises its own `oom_score_adj` to 500 before it starts the
  agent, which passes it on to everything it starts, so the kernel's out-of-memory killer picks them before VS Code's
  processes, which run at 200 to 300. macOS needs neither: tmux runs detached from VS Code, and macOS never kills a
  group of processes together.
- **Solution:** `TmuxInfraService` probes `systemd-run --user --scope -- true` once at start and annotates its span with
  `canRunInOwnScope`; when it fails (macOS, WSL without systemd, a container) sessions start as before. A tmux server
  already running keeps its cgroup until it next starts. The setting is checked against a pattern in `package.json` and
  in `SessionSettings`, so an invalid value fails the start with the settings error instead of an agent that exits.
- **Alternatives considered:** moving only the tmux server out of VS Code's cgroup, which leaves every agent in one, so
  one agent's OOM still kills them all; a scope named by the session's id, which fails to start while an earlier one
  lives on through a leftover child; moving a running server with systemd's `AttachProcesses`, more code for a state
  that ends with the next restart; `MemoryHigh`, which throttles instead of killing and leaves the machine slow. A
  watchdog in `aggregor-pty` that adds up the agent's processes' memory and stops them over the limit, the only cap for
  macOS, WSL without systemd and containers: a fair amount of Rust for platforms nobody runs yet. A one-time hint in WSL
  without systemd to set `[boot] systemd=true` in `/etc/wsl.conf`: the trace's `canRunInOwnScope=false` says it already.

## Codex resumes its own conversation by id

- **Problem:** Codex can't start a conversation under an id we give it, and plain `codex resume` opens a picker of the
  project's conversations rather than the session's own. Codex 0.167 also runs turns in a shared background server by
  default, so ending a session's tmux session left a running turn working with no tab.
- **Decision:** Codex runs with `-c tui.terminal_title=["thread-title"]`, which makes its window title the thread's id
  until the thread has a name, then the name. `aggregor-pty` writes a window title that is a bare UUID to
  `agentSessionId`, the latest one, so a new thread started with `/new` replaces it. `${agentSessionId}` fills it in,
  and Codex's `resumeArgs` are `resume --no-daemon -c tui.terminal_title=… ${agentSessionId}`; a resume that needs it
  while it is unknown fails with `AgentSessionIdNotFoundError`. Codex runs with `--no-daemon` both ways, so its turns
  stop with its tmux session. Agents that take our id keep it (Claude, OpenCode, Copilot), and Antigravity keeps `-c`.
  An exact resume, from a title Codex shows by itself, with no prompt and no reading of Codex's files.
- **Solution:** Codex showing the id as its title isn't documented, and the option replaces any `tui.terminal_title` of
  the user's. Codex sessions don't show in `codex agents`. Codex reports `working` for a moment at startup, so a session
  that never got a message counts as worked, and once its agent has stopped, `codex resume ‹id›` finds no saved thread
  and exits, closing the tab.
- **Alternatives considered:**
  - `codex resume --last`: the project's newest conversation, wrong once a project has two Codex sessions.
  - Reading Codex's session files (`~/.codex/sessions/…/rollout-‹time›-‹id›.jsonl`), whose layout Codex is migrating.
  - A `SessionStart` hook passed with `-c`, which hands over the id as documented, but Codex holds it behind a "Hooks
    need review" prompt whenever the hook is new or changed.
  - Every agent on its own ids: our id stays the row's, the tmux session's and the status key anyway, so each session
    would carry two; most agents show theirs nowhere (Claude's title is the conversation's name), and an agent that dies
    before showing it can't be resumed.
  - The extension recording the id from the title: more code, and `aggregor-pty` writes what comes from the agent's
    output.

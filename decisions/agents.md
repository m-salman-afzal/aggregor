# Agents

Which CLIs a session can run, and how a session picks one.

## Agents are settings entries

- **Problem:** each agent was code: Claude Code's launch plan, placeholder titles and icon sat in
  `ClaudeCodeAgentInfraService`, behind `IAgentInfraService` and a `LayerMap` keyed by agent id, so supporting another
  CLI meant a new infra service.
- **Decision:**
  - An agent is `AgentEntity`, identified by its settings key (`AgentIdValueObject`, a branded string), and read through
    `IAgentRepository` (`findAll`, `findById`). It is no `BaseEntity`, since it isn't a row.
  - `aggregorApp.agents` holds one entry per agent key, `{name, command, args, resumeArgs, env, icon}`, edited in
    settings.json. Every field is optional: `command` and `name` default to the key, `args` to none, `resumeArgs` to
    `args`, `env` to none and `icon` to Aggregor's logo. `args` and `resumeArgs` take two variables: `${sessionId}`, and
    `${agentSessionId}` (see "Codex resumes its own conversation by id"). The setting has `machine` scope, so only user
    settings define commands, and its default holds the built-ins (`claude`, `codex`, `agy`, `opencode`, `copilot`),
    which VS Code merges with the user's entries field by field, `env` name by name; `null` hides one. An entry that
    doesn't decode, a variable name that isn't a POSIX name included, is left out with a warning, read once at start and
    again on each change of the setting.
  - `env` holds the variables the agent starts with, passed as tmux `new-session -e NAME=value`. Claude's default is
    `CLAUDE_CODE_TMUX_TRUECOLOR=1`: Claude drops to 256 colours whenever `TMUX` is set unless it is set, though
    Aggregor's tmux passes 24-bit colour. An agent added later that dims its colours in tmux gets its own switch the
    same way. A setting rather than a line in `tmux.conf`, so each agent's switches sit in its own entry and the user
    can add their own; hiding `TMUX` from every agent was rejected, since agents rely on it for clipboard, images and
    keys.
  - The domain's `prepareLaunchPlan(agent, session)` takes `resumeArgs` once the session has worked, else `args`, fills
    in the variables and returns a `LaunchPlanValueObject`, which the session's tab runs under `aggregor-pty`.
  - A session whose agent is gone shows a warning icon, and opening it fails with `AgentNotFoundError`.
  - An icon is the path of an SVG or PNG image (an entry naming another file is left out), relative ones inside the
    extension; codicons were dropped, so every agent shows a logo, in its rows, tabs, picker and desktop notifications
    alike. `assets/agents/` holds Claude Code's logo, OpenCode's and Copilot's (simple-icons 16.30.0, CC0, in OpenCode's
    grey `#8B929C`), Codex's and Antigravity's app icons (lobe-icons 1.102.0, MIT; Codex's without its white tile, which
    stood out on a dark theme), and Aggregor's logo in the same grey, which an entry without an icon shows. Codicons for
    Codex (`code`), Antigravity (`rocket`) and Copilot (`copilot`) came first.

  Another CLI is one settings entry, and the rules about launching and titles are the domain's, the same for every
  agent.

- **Alternatives considered:** the agent interface. An agent as a value object, kept in a map keyed by agent id inside
  `ISettingsConfig`: smaller, but the identity lives outside the object. Merging the built-ins with the user's entries
  ourselves, which VS Code turned out to do already. Four flat settings, `aggregorApp.agents.commands`,
  `.resumeCommands`, `.names` and `.icons`, from agent key to a command line or text (tried): the Settings editor edits
  those in place, where it sends the nested setting to settings.json, but four tables for one thing cluttered Aggregor's
  settings.

## New Session asks which agent, among those installed

- **Problem:** with five built-in agents, starting a session has to say which, and offering one that isn't installed
  only fails in its terminal.
- **Decision:**
  - The project row's "New Claude Session" became "New Session"; New Session's dialog shows the agent beside the project
    and the working tree (see `sessions/worktrees.md`).
  - The picker lists the agents whose command is on `PATH` (plus `PATHEXT` on Windows), looked up in the extension host
    each time through `IShellCommandInfraService.listInstalledCommands`, so a new install shows without a reload. Each
    row is an `AgentListItemDto` from `listAgents`: icon, name, the command as the description, the default first and
    marked. The view sends the list to the webview when it draws, and again when an agent setting changes.
  - A row's **Set as Default** button runs `setDefaultAgent`, which saves `aggregorApp.defaultAgent` to user settings
    through `ISettingsConfig.saveDefaultAgentId`, and picks that agent.
  - The webview picks: one agent installed, or `aggregorApp.skipAgentPicker` on with the default installed, starts the
    session without the picker. `newSession` takes the agent, or none for the default or the only one installed; none
    installed fails with `NoAgentInstalledError`, naming the commands searched for, with **Open Settings**.

  Which agents are installed is the backend's fact about the machine; whether to ask is the front end's.

- **Alternatives considered:** `AgentRepository.findAll` leaving out uninstalled agents, which mixes what is configured
  with what is on this machine. The use case picking, with the picker shown through a port, built first (see "The
  webview asks the user" in sessionsView/menus.md). Error messages without a way to the setting.

# Agent API

How an agent CLI (Claude Code, Codex…) manages Aggregor: a small HTTP API the extension serves, and a skill that tells
the agent how to call it.

## Agents manage Aggregor through a skill and an HTTP API, not MCP

- **Problem:** an agent running in a session should be able to do what the user does in the Sessions view: start,
  rename, archive and stop sessions, list projects, read a project's branches.
- **Decision:** the extension serves an HTTP API, and a skill tells the agent to call it with `curl`. Every agent CLI
  runs shell commands and reads skills, so one API serves them all, with nothing to install or register per agent, and
  the API runs inside the window that already holds the commands and the data.
- **Solution:** `AgentApiView` (`presentation/views/agentApi/agentApi.view.ts`) serves the routes; the skill is written
  apart from the extension.
- **Alternatives considered:**
  - An MCP server, over stdio or HTTP: each agent CLI registers MCP servers in its own config, and a stdio server would
    be a second process that still has to reach the window that runs the commands.
  - A skill alone, which edits `settings.json` or the database: it reaches only settings, and writes the database behind
    the window's back.

## The agent API is HTTP on a Unix socket the first window owns

- **Problem:** the API runs commands as the user, so only the user may reach it, and every window runs the extension.
- **Decision:** HTTP on a Unix socket, `api.sock` in the Aggregor folder (`~/.aggregor`, `~/.aggregorDev` from F5), mode
  0600, so only its owner can connect, with no port, token or Host check to get right. One window serves it: the first
  whose server answers there.
- **Solution:** `AgentApiServerInfraService` provides Effect's `HttpServer` in `InfrastructureLayer`, and
  `ApplicationLayer` passes that one service on to presentation, which sees no other infrastructure. When the window
  starts it connects to `api.sock`: when something answers, it logs that another window serves the API and provides a
  server that serves nothing; when the connection is refused, it removes the stale file and listens with
  `NodeHttpServer`, then sets the file's mode. A failure to listen is logged and leaves the window without the API. The
  server closes with the runtime, and Node removes the socket file as it closes. Limit: when the serving window closes,
  the others don't take over until they restart.
- **Alternatives considered:** a localhost port, with a token in a file only the user can read and a Host header check
  against DNS rebinding: more to get right, and any local process can try the port.

## The API runs each registered command from the middleware's table, with no notification

- **Problem:** the API has to run the same commands the menus and the webview run, with their decoding and their error
  messages, but a failure must come back to the agent rather than show in the window.
- **Decision:** `RegisterCommandMiddleware` keeps a table of every command a controller registers: its id, its request's
  JSON Schema, and a run that decodes the request, runs the controller under the same root span, named by the command
  id, as a VS Code run, and hands back a typed failure: the decode issue for invalid arguments, or the message the
  command's error message would have shown. `POST /commands/<commandId>` runs a command from it. Every command reaches
  the API with no route written for it, and VS Code's own runs still notify as before.
- **Solution:** `registerCommand` puts each command in the table as it registers it with VS Code;
  `runCommandWithoutNotification` runs one. `RegisterCommandMiddleware.layer` is one value that every controller's layer
  provides, and a runtime builds a layer value once, so the controllers and `AgentApiView` share one table. The answer
  is 200 `{"result": …}`, 404 for an unknown command, 400 `{"error": "InvalidArguments", "message": …}` for JSON that
  doesn't parse or a request that doesn't decode, and 422 `{"error": "CommandFailed", "message": …}` for a failed
  command.
- **Alternatives considered:** running commands with `executeCommand`, which turns every failure into a notification and
  resolves as if the command worked.

## `registerCommand` decodes each command's request, and `GET /commands` lists their schemas

- **Problem:** the skill must say which commands exist and what each takes, and a hand-written list drifts from the
  code. Each controller decoded its own argument, so the request a command takes was known only inside its controller.
- **Decision:** `registerCommand` takes the command's request schema, its request DTO's, and decodes VS Code's argument
  with it, so a controller function gets its decoded request; `registerCommandWithoutRequest` registers a command that
  takes none, and ignores the row VS Code hands a title button. `GET /commands` lists every registered command with its
  request's JSON Schema, which the skill tells the agent to read first, so the skill never lists commands itself.
- **Solution:** both take an object: `{commandId, requestSchema, controller, getCommandErrorMessage}`, and the same
  without `requestSchema`. `Schema.toJsonSchemaDocument` writes each schema as a draft 2020-12 JSON Schema with its
  `$defs`. Generate Commit Message decodes Source Control's argument, so its schema is that argument's
  (`{rootUri?: {fsPath}}`). The Sessions view's reads keep decoding their own input. Limit: the JSON Schema is the JSON
  form, which allows `null` for an optional field, while the request decodes as VS Code passes it, so `null` there is an
  invalid argument; leave the field out instead.
- **Alternatives considered:** a hand-written list of commands and arguments in the skill; each controller decoding its
  own argument with `VscodeUtils`'s `decodeVsCodeArgument`, as before, which kept the schemas out of reach.

## Read routes return the Sessions view's lists

- **Problem:** an agent needs the ids and paths a command takes: the projects, their sessions, the agents.
- **Decision:** read routes call the same controller functions the Sessions view draws from and return their DTOs as
  JSON, so the agent sees what the user sees, from the same use cases.
- **Solution:** `GET /projects` (each project with its first page of sessions),
  `GET /projects/sessions?projectPath= &shownPageCount=` (one project with that many pages, as Show more asks),
  `GET /archive` (each project with its archived sessions), `GET /agents`,
  `GET /projects/importable-sessions?projectPath=`, `GET /projects/branches?projectPath=` (after fetching origin),
  `GET /projects/leftovers?projectPath=`, `GET /sessions/pull-requests?sessionId=`, `GET /sessions/processes?sessionId=`
  (one reading of what a session's dropdown lists, from `SessionProcessService.getSessionProcesses`) and
  `GET /review-comments`. A missing or invalid query answers 400 `InvalidArguments`; a failed read 422
  `{"error": "ReadFailed", "message": <its error's tag>}`.

## An agent adds a project by its path

- **Problem:** Add Project opens VS Code's folder picker, which an agent can't answer, so an agent asked to add a
  repository had no way to.
- **Decision:** `aggregorApp.addProjectFolder` takes `{projectPath}`, an existing folder, and adds it as Add Project
  adds a picked one; a path that isn't a folder fails with `ProjectFolderNotFoundError`. Add Project keeps its picker.
- **Solution:** `ProjectService.addProjectFolder` checks the folder with `IWorkspaceInfraService.isExistingFolder`, then
  shares `addChosenFolderPaths` with `addProject`.
- **Alternatives considered:** an optional `projectPaths` on Add Project's request, which the webview's request without
  a body would have to send as an empty object; adding a folder that doesn't exist, which shows an empty project whose
  sessions fail to start.

## One command writes any Aggregor setting, with a request member per setting

- **Problem:** an agent asked to change an Aggregor setting needs to know which settings exist and which values each
  takes, and the write has to reach VS Code the way the Settings editor's does.
- **Decision:** `aggregorApp.updateSetting` takes `{setting, value}`, a union with one member per `aggregorApp.*`
  setting in `package.json`, each `value` typed as the setting declares it: enums as their values, `fontSize` with its
  minimum and maximum, patterns as patterns, and `agents` as a record of agent entries or `null`. `GET /commands` turns
  the union into JSON Schema, so it documents the valid values, and a wrong one fails as `InvalidArguments` before
  anything is written. It writes the user's settings through VS Code and returns `{settingId, previousValue, newValue}`,
  so the agent can report or undo the change. `GET /settings` returns every setting's current value.
- **Solution:** `UpdateSettingRequestDto` and `AggregorSettingsDto` (`settings.dto.ts`) share one schema per setting;
  `SettingsService.updateSetting` saves through `ISettingsConfig.saveUserSetting`, which returns the setting's effective
  value from before the write and fails with `SettingSaveFailedError`. Limit: a workspace or folder value of the setting
  still overrides the user's. A value VS Code holds that the schema rejects, such as a `fontSize` out of range, fails
  `GET /settings` as `ReadFailed`.
- **Alternatives considered:** the agent editing `settings.json` itself: each VS Code profile has its own file, and the
  window doesn't validate what lands there; a command per setting, many commands for one gesture.

## The skill carries VS Code's preferred look, which the agent writes into the user's settings

- **Problem:** Aggregor reads best in VS Code set up a certain way (the side bar on the right, the activity bar on top,
  the panel at the bottom aligned right, and a calmer chrome), and the user should be able to ask an agent for it.
- **Decision:** the skill lists those VS Code settings, taken from the author's own `settings.json`, and tells the agent
  to change them in the user's `settings.json` itself: only those keys, keeping the file's other lines and comments,
  after showing the user the current values and getting their agreement. The panel's alignment is window layout, not a
  setting, so the skill tells the agent to have the user run **Set Panel Alignment to Right**. Aggregor has no code for
  it: an agent edits a settings file as well as any command would.
- **Solution:** the "VS Code's look" section of `AGENT_SKILL.TEXT`, with the settings file's place on Linux and macOS
  and for a profile. Themes, icon themes and fonts stay out: they need extensions or fonts the user may not have.
- **Alternatives considered:** an `aggregorApp.applyLayout` command that wrote `workbench.sideBar.location` and
  `workbench.activityBar.location` through VS Code and ran `workbench.action.positionPanelBottom` and
  `workbench.action.alignPanelRight`: a port, an infra service and a command for what a settings edit does, and it could
  only cover the two layout settings it was written for.

## Aggregor writes its agent skill to both skill folders on every start

- **Problem:** an agent only calls the API when a skill tells it how, each agent CLI reads skills from its own folder,
  and the skill has to name the socket of the build that runs the session: `~/.aggregor`'s for the installed build,
  `~/.aggregorDev`'s for F5's.
- **Decision:** when the window starts, Aggregor writes `skills/aggregor/SKILL.md` into Claude Code's folder
  (`~/.claude`, or `$CLAUDE_CONFIG_DIR`) and into `~/.agents`, which Codex and the others read, rewriting a file only
  when its text differs. The text is the same for every build: it reads the socket from `AGGREGOR_API_SOCKET`, which
  every agent's and folder shell's tmux session gets set to its build's socket, and falls back to
  `~/.aggregor/api.sock`. A failed write is logged as a warning and never stops the window.
- **Solution:** the text is `AGENT_SKILL.TEXT` (`@pkg/constants/src/agentApi.constant.ts`): the calls, the reads, and a
  use case per user request (sessions, projects, pull requests, review comments, commit, agents and settings) naming its
  command and fields, with each command id and route taken from its constant so a rename reaches the skill;
  `AgentSkillService.installAgentSkill`, which `BackgroundJobs` starts, hands it to
  `IAgentSkillInfraService.writeAgentSkill`. `SessionAgentUtils` and `FolderShellUtils` pass
  `-e AGGREGOR_API_SOCKET=<socket>` to `tmux new-session`, from `AgentApiSocketUtils.getAgentApiSocketPath`, which the
  server listens on too. An agent or shell started before the change has no variable until it starts again.
- **Alternatives considered:** a Connect Agents button the user presses to write the skill, one more step before an
  agent can help; the socket's path written into the skill's text, which F5's and the verify skill's builds would
  overwrite with their own on every start.

# DDD

How `apps/extension/src` is layered: where each kind of code goes, what it is named, and the lint that checks both.
Every file but `extension.ts` sits in one of four layers, and its name says which role it plays there. A change that
moves where code goes updates this file in the same commit.

## Concepts

The building blocks, as Evans (_Domain-Driven Design Reference_), Vernon (_Implementing Domain-Driven Design_, ch. 14)
and Martin (_The Clean Architecture_) define them, and where each sits here.

- **Entity:** an object "distinguished by its identity, rather than its attributes", whose identity runs through time:
  `SessionEntity`, `ProjectEntity`, `AgentEntity`. Each entity is its own aggregate root.
- **Value object:** an object that describes or computes a characteristic of something and has no identity of its own;
  "when you care only about the attributes and logic of an element of the model, classify it as a value object". It is
  immutable and compared by value: a session's status, a project's path, an agent id, an entity's id. Anything that is
  identified by an id or a path is not one, however small: a session as a list row is a DTO, not a value object.
- **Domain service:** a domain rule that is not one entity's own: `getSessionStatus`, `getSessionTitleToSave`.
- **Repository:** query and write access to an aggregate, declared in the domain and implemented in infrastructure.
- **Application service:** a use case. It "defines the jobs the software is supposed to do and directs the expressive
  domain objects to work out problems", holds no business rules, and talks to the outside through ports.
- **DTO:** the data that crosses between presentation and an application service: a request DTO in, a response DTO out.
  "We don't want to cheat and pass Entities", so presentation never sees an entity. A service builds its response DTOs
  (Vernon's DTO assembler); the domain never does.
- **Controller:** takes the FE's input, validates it, makes the request DTO and calls one application service. Nothing
  else.
- **Presenter:** turns what a use case returns into what the user sees: here, a failure into its message.
- **View:** draws response DTOs with VS Code's APIs, or sends them to a webview that draws them. It has its own things
  (badges, the webview's page and messages) and decides nothing about the data.

## Layers

```text
┌──────────────────────────────── packages ────────────────────────────────┐
│ @pkg/constants  every constant outside the domain, one file a feature    │
│ @pkg/vscode     VsCodeApi (the one runtime `vscode` import), vscode      │
│                 helpers, decodeVsCodeArgument                            │
└─────────▲──────────────── shared by FE and infra ────────────▲───────────┘
┌─ presentation (FE) ┴───────────────────────┐                 │
│ views       draw DTOs: trees, webviews     │                 │
│ controllers input → request DTO → service  │                 │
│ presenters  failure → message              │                 │
│ routes, middlewares                        │                 │
└─────────┬──────────────────────────────────┘                 │
          │ services, DTOs                                     │
┌─ application ▼─────────────────────────────┐  ┌─ infrastructure ┴────────────┐
│ services    use cases; assemble DTOs       │◄─┤ implements the ports:        │
│ dtos        request and response DTOs      │  │ repositories, models,        │
│ interfaces  ports                          │  │ migrations, infra services,  │
│                                            │  │ config, layer graph, logger  │
└─────────┬──────────────────────────────────┘  └───────────────┬──────────────┘
          ▼                                   implements repositories ▼
┌─ domain ─────────────────────────────────────────────────────────────────────┐
│ entities, repository interfaces, value objects, domain services              │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Layer             | Holds                                                                                    | May import                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `domain/`         | Entities, value objects, domain services, repository interfaces and their errors         | `effect`, domain                                                                                                              |
| `application/`    | Services (the use cases), DTOs, the interfaces of the infra services and config they use | `effect`, `@pkg/constants`, domain, application                                                                               |
| `infrastructure/` | Models, repositories, infra services, config, the layer graph, the trace log             | `effect`, `@effect/*`, `drizzle-orm`, `jsonc-parser`, `vscode` types, `node:*`, `@pkg/*`, domain, application, infrastructure |
| `presentation/`   | Command routes, the command middleware, controllers, presenters, views                   | `effect`, `vscode` types, `@pkg/*`, and from the layers below only services and DTOs, each part as listed below               |
| `extension.ts`    | `activate`: builds the runtime from the layer graph                                      | everything                                                                                                                    |

- Dependencies point inward. Application declares the interfaces it needs, infrastructure implements them, and
  application never imports infrastructure.
- Interfaces speak only domain types and DTOs, never `Memento`, `Terminal` or other `vscode` types.
- `@pkg/vscode`'s `vscode.api.ts` holds the one runtime import of `vscode`; everything else yields `VsCodeApi`.
  Infrastructure and presentation import only `vscode`'s types, and application and domain never see it.
- Presentation imports nothing from the domain or infrastructure. What it shares with infrastructure (VsCodeApi, the
  vscode helpers, argument decoding) lives in `@pkg/vscode`; constants live in `@pkg/constants`.
- Within presentation:
  - **Controllers** import `@services`, `@dtos` and `@pkg/vscode`'s `vsCodeArgument.utils.ts`.
  - **Presenters** import `@pkg/constants`, and `@services` for types only.
  - **Views** import `@controllers`, their own files, `@pkg/*`, and `@dtos` for types only.
  - **Routes and middlewares** import `@controllers`, `@middlewares`, `@presenters` and `@pkg/*`.
- `presentation/` lives inside `src`, because the extension ships as one bundle. The Sessions view's webview is the
  exception: `apps/webview` draws it, in VS Code's page, apart from the extension, and follows the folder-structure
  skill instead of these layers. It imports only the view's `.view.type.ts` and DTOs, for types only (lint rejects a
  value import), `@pkg/constants`, and its design system, `@pkg/ui`; its build lands in the extension's `dist/webview`.

Each folder directly under a layer has one import alias in `apps/extension/tsconfig.json`:

| Layer            | Aliases                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `domain`         | `@domainServices` (`services`), `@entities`, `@valueObjects`                                                                        |
| `application`    | `@interfaces`, `@services`, `@dtos`                                                                                                 |
| `infrastructure` | `@config`, `@models` (`database/models`), `@di`, `@logger`, `@repositories`, `@infraServices` (`services`), `@infraUtils` (`utils`) |
| `presentation`   | `@controllers`, `@middlewares`, `@presenters`, `@views`                                                                             |

Code is imported only through them, so each file has one import path, and by name: lint (`no-restricted-syntax`) bans
`import * as`, `vscode` included; `extension.ts` imports `./presentation/routes.ts`, the one file at a layer's root.
`packages/eslint/src/layers/importRules.ts` checks the import columns with a `@typescript-eslint/no-restricted-imports`
regex allow-list per folder (`IMPORT_RULES`: each layer, then presentation's controllers, presenters and views), which
also rejects relative imports.

## Naming

Each file's suffix names its role, each role lives in one layer, and the file's main names carry the role.
`packages/eslint/src/layers/roleNames.ts` checks the names with `@typescript-eslint/naming-convention`, one block per
file suffix.

| Role                    | Layer                             | File                                                    | Names                                              |
| ----------------------- | --------------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| Entity                  | domain                            | `entities/<x>/<x>.entity.ts`                            | `SessionEntity`                                    |
| Value object            | domain                            | `valueObjects/<x>.valueObject.ts`                       | `EntityIdValueObject`, `EntityIdValueObjectSchema` |
| Repository interface    | domain                            | `entities/<x>/<x>.repository.interface.ts`              | `ISessionRepository`                               |
| Domain service          | domain                            | `services/<x>.domainService.ts`                         | functions                                          |
| Application service     | application                       | `services/<x>.service.ts`                               | functions                                          |
| DTO                     | application                       | `dtos/<x>.dto.ts`                                       | `SessionListItemDto`, `SessionListItemDtoSchema`   |
| Infra service interface | application                       | `interfaces/<x>.infraService.interface.ts`              | `ITerminalInfraService`                            |
| Config interface        | application                       | `interfaces/<x>.config.interface.ts`                    | `ISettingsConfig`                                  |
| Repository              | infrastructure                    | `repositories/<x>.repository.ts`                        | `SessionRepository`, `makeBaseRepository`          |
| Model                   | infrastructure                    | `database/models/<x>.model.ts`                          | `SessionTableModel`, `BASE_COLUMNS`                |
| Infra service           | infrastructure                    | `services/<backend>/<x>.infraService.ts`                | `TerminalInfraService`                             |
| Transformer             | infrastructure                    | `services/<backend>/<x>.transformer.ts`                 | functions                                          |
| Config                  | infrastructure                    | `config/<x>.config.ts`                                  | `SettingsConfig`                                   |
| Layer                   | infrastructure                    | `di/<x>.layer.ts`, `logger/<x>.layer.ts`                | `AppLayer`                                         |
| Routes                  | presentation                      | `routes.ts`                                             | `RoutesLayer`                                      |
| Controller              | presentation                      | `controllers/<x>.controller.ts`                         | functions                                          |
| Presenter               | presentation                      | `presenters/<x>.presenter.ts`                           | functions                                          |
| Middleware              | presentation                      | `middlewares/<x>.middleware.ts`                         | `registerCommand`                                  |
| View                    | presentation                      | `views/<x>/<x>.view.ts`                                 | `SessionsView`                                     |
| Helpers                 | any                               | `utils/<x>.utils.ts`, or beside the one file they serve | functions                                          |
| Shared types            | any                               | `<declaring file>.type.ts`, beside it                   | plain names                                        |
| Error                   | the highest layer that handles it | the top of a file (see Errors)                          | `SessionNotFoundError`                             |

- File and folder names are camelCase in every dotted part, as in `terminal.infraService.type.ts`;
  `unicorn/filename-case` checks them everywhere but `.claude`, whose skill folders follow Claude Code's names.
- An implementation's file is its interface's file without `.interface`, so a search for `terminal.infraService` finds
  the interface, with its errors and types, and its implementation.
- `I` marks only our interfaces: the `Context.Service` classes, which lint keeps in `.interface.ts` files, and
  `IBaseRepository`, the shape every repository interface extends. Data shapes take no prefix.
- A type that stands alone sits at the top of a file, right after the imports. A type built from a value of its own
  file, directly or through another such type, sits below what it is built from, so the file reads top down: a value
  object's or DTO's type right after its schema (`AgentListItemDtoSchema`, then `AgentListItemDto`), an error union
  after its errors. An interface's own types (its inputs, which end in `Request`, and `Settings`) sit in its
  `.interface.ts`. Types several implementation files share live in a `.type.ts`, which holds nothing else.
  `aggregor/type-placement` (`packages/eslint/src/rules/`) checks where types sit, and `no-restricted-syntax` the rest.
- A DTO is a `Schema.Struct` (or `TaggedUnion`), so a controller validates its input by decoding into it. A request DTO
  is `<UseCase>RequestDto`, one per use case; a response DTO is named for what it is to the user (`SessionListItemDto`).
- A controller function is named for its input, or for its caller when the caller is a view: `removeChosenSession`,
  `newSessionAskingForProject`, `generateCommitMessageForSourceControl`, `getSessionListItemForSessionsView`.
- A `.type.ts` file sits beside the file that declares it, so its interface or implementation is the file next to it.
- Files that share their first dotted part sit in a folder of that name, as in `views/sessions/` and
  `entities/session/`; files with different first parts stay flat, as in `services/`, `interfaces/` and `valueObjects/`.
- Every `Effect.fn` span is named `<owner>.<const>`. A config, controller, domain service, infra service, layer,
  middleware, presenter, repository, service or view file owns its spans, and the owner is its file name:
  `SessionService.openSession`, `RegisterCommandMiddleware.registerCommand`, and a layer's `make<Owner>` is
  `<Owner>.make`. A helper file belongs to the one owner in its folder (`vscode/terminal/terminal.utils.ts` to
  `TerminalInfraService`); a file with no owner gives the bare const name (`acquireScopedDisposable`). A command's root
  span is its command ID.
- The aggregor plugin (`packages/eslint/src/rules/`, one file per rule) checks the span names, the `.type.ts` placement,
  the stem folders, where constants live and that a comment is one line, and fixes span names; for `apps/webview`, it
  also checks the folder-structure skill's rules (`packages/eslint/src/folderStructure/`).
- A constant lives in `@pkg/constants/src/<feature>.constant.ts`: ids, labels and texts, and also file and folder names,
  environment variables, external commands, VS Code's and other extensions' ids, timings and patterns. Constants that
  describe one thing share an object with a label per value (`TMUX.SOCKET_FILE_NAME`, `SESSIONS_VIEW.ID`). The domain,
  which can't import `@pkg/constants`, keeps its patterns beside its rules, and a model's `BASE_COLUMNS` is code. Not
  constants: log messages, which read beside their code, and the arguments of a command line being built.
  `aggregor/constant-placement` flags a module-level const named in UPPER_CASE, or set to a bare literal, anywhere else
  in the extension and `@pkg/vscode`.
- A constant holds no logic: it is a literal, or a text with holes, an arrow whose whole body is one template literal
  (`` (displayName) => `${displayName} finished` ``). A text that depends on a case is one constant per case, and a util
  beside the code that uses it picks one: a presenter for an error's message, `application/utils` for a question a use
  case asks. Lint (`CONSTANT_BANS` in `syntaxBans.ts`) bans conditions, calls, spreads and operators in
  `@pkg/constants`, and any other function there.
- An aggregate of several entities would get an `.aggregate.ts`.

## Tree

```text
packages/
  constants/src/                           one file per feature, each with its command ids, labels, notices, error
                                           texts and the feature's other constants: app, commitMessage, database,
                                           git, agent, process, project, session, sessionAlert, sessionsView,
                                           terminal, tmux, vscode (VS Code's own command ids),
                                           workspace
  eslint/src/                              the repo's ESLint setup: base/ per file type, layers/ the DDD layering
                                           checks, folderStructure/ apps/webview's checks, rules/ the aggregor
                                           plugin (one file per rule), and eslint.config.ts composing them
  ui/src/                                  apps/webview's design system: theme.css (shadcn's tokens and the status
                                           colours from VS Code's theme) and components/base/, shadcn's components
                                           on Base UI, which shadcn's CLI writes (components.json)
  vscode/src/
    vscode.api.ts                          VsCodeApi: the only runtime import of vscode, and the extension's id
    vscode.utils.ts                        acquireScopedDisposable, streamVsCodeEvent, setWhenClauseContextKey,
                                           runWithProgressIndicator, openAggregorSettingsInSettingsEditor,
                                           showErrorNotificationWithoutWaiting (with an Open Settings button when
                                           given a setting)
    vsCodeArgument.utils.ts                decodeVsCodeArgument; InvalidVsCodeArgumentError
apps/extension/src/
  domain/
    entities/
      base/
        base.entity.ts                     BaseEntity (Schema.Class: id, sortId, updatedAt, deletedAt; fromRow, the
                                           factory every stored row goes through)
        base.repository.interface.ts       IBaseRepository<Entity, AddRequest>: add, findById, findMany, update,
                                           upsert, softDelete, placeAtEnd, entityChanges; EntityChange;
                                           DatabaseReadError, DatabaseWriteError, EntityNotFoundError
      session/
        session.entity.ts                  SessionEntity (BaseEntity and projectId, projectPath, name, customName,
                                           agentId, viewedAt, lifecycle, and aggregor-pty's status, statusKind,
                                           statusMessage, statusProgress, statusChangedAt, hasWorked, reportedTitle,
                                           terminalTitle and agentSessionId; displayName)
        session.repository.interface.ts    ISessionRepository: the base calls
      project/
        project.entity.ts                  ProjectEntity (BaseEntity and path, isAdded, settings)
        project.repository.interface.ts    IProjectRepository: the base calls
      agent/
        agent.entity.ts                  AgentEntity (id, name, command, args, resumeArgs, environmentVariables,
                                           icon): an agent CLI,
                                           from the settings, not a BaseEntity
        agent.repository.interface.ts    IAgentRepository: findAll, findById; AgentNotFoundError
    valueObjects/                          EntityIdValueObject (a branded UUID v7), ProjectPathValueObject (branded),
                                           AgentStatusValueObject and StatusKindValueObject (literals: OSC 7501's
                                           states and kinds), SessionStatusValueObject (the status the user sees,
                                           picked from the agent's), SessionLifecycleValueObject (literals:
                                           ongoing, archived), AgentIdValueObject (branded: the settings
                                           key), AgentIconValueObject (an image file's path),
                                           EnvironmentVariablesValueObject (names to values),
                                           LaunchPlanValueObject (a command, its arguments and its variables),
                                           EntityChangeKindValueObject (literals: placed, updated, removed),
                                           ProjectSettingsValueObject (a project's settings, every key with its
                                           default), SessionWorkingTreeValueObject (literals: root, worktree)
    services/
      session.domainService.ts             prepareLaunchPlan, getDefaultSessionName, getSessionTitle,
                                           getSessionTitleToSave, getSessionStatus, isSessionTurnRunning,
                                           getAlertedStatus, isSessionWaitingOnUser
      entityId.domainService.ts            makeEntityId, getEntityIdCreatedAt: the entity id's factory
      sortOrder.domainService.ts           findEntityIdsToPlaceAtEnd, canMoveUpInOrder, canMoveDownInOrder: how
                                           rows move within an order
  application/
    services/
      base.service.ts                      addEntity, findEntityById, findEntities, updateEntity, upsertEntity,
                                           removeEntity, placeEntitiesAtEnd, on any repository
      session.service.ts                   newSession (in a project, with an agent or the default one),
                                           openSession, archiveSession, unarchiveSession, removeSession,
                                           renameSession, stopSessionAgent, stopProjectSessionAgents,
                                           stopArchivedProjectSessionAgents, stopOngoingSessionAgents,
                                           stopArchivedSessionAgents, moveSessionUp, moveSessionDown (each session
                                           moves among its project's sessions in its own list);
                                           the lists: listProjectsWithSessions and listProjectsWithArchivedSessions
                                           (each project with its sessions' rows), listProjectSessions,
                                           getSessionListItem,
                                           watchSessionListChanges, watchViewedSessionIds, findViewedSessionId,
                                           listSessionsWaitingOnUser (the badge and each view's count);
                                           startSessionTitleSync, startSessionTabNameSync, startViewedAtSync
      agent.service.ts                     listAgents (the installed agents, the default first), setDefaultAgent,
                                           findAgentToStart; NoAgentInstalledError
      sessionAlert.service.ts              watchSessionAlerts: the states sessions out of view hold for 3 seconds,
                                           as notifyOn picks them; notifyOnDesktop
      project.service.ts                   listProjects, getProjectListItem, findProjectListItem, addProject
                                           (asks for folders), addProjectPaths, findOrAddProject, removeProject,
                                           moveProjectUp, moveProjectDown, newProjectTerminal,
                                           saveProjectSettings; ProjectNotListedError
      commitMessage.service.ts             generateCommitMessage: writes the message with Source Control's progress
      workspace.service.ts                 startShownProjectSync: the viewed session's project as the only
                                           project folder; startSessionReopenAfterReload
    dtos/
      session.dto.ts                       SessionListItemDto, ProjectSessionsDto (a project's row with its sessions'
                                           rows), SessionListChangeDto, and a request DTO per session use case
      sessionAlert.dto.ts                  SessionAlertDto, NotifyOnDesktopRequestDto
      agent.dto.ts                         AgentListItemDto: a row of the agent picker; SetDefaultAgentRequestDto
      project.dto.ts                       ProjectListItemDto with its ProjectSettingsDto, and a request DTO per
                                           project use case
      commitMessage.dto.ts                 GenerateCommitMessageRequestDto
    interfaces/                            each with the errors and types its signatures name
      terminal.infraService.interface.ts   openSessionTerminal, focusSessionTerminal, closeSessionTerminal,
                                           openProjectTerminal, nameActiveSessionTab, activatedSessionIds,
                                           viewedSessionId; SessionTabRequest, SessionTabCommand,
                                           TerminalLaunchFailedError
      tmux.infraService.interface.ts       prepareSessionTabCommand, waitForSessionAgentStart, stopSessionAgent,
                                           runningSessionIds, refreshRunningSessionIds, startedOrStoppedSessionIds;
                                           SessionTabCommandRequest, PtyBinaryNotFoundError, TmuxUnavailableError
      userInputPrompt.infraService.interface.ts
                                           pickProjectFolderPaths: the system's folder dialog;
                                           FolderPickCancelledError
      shellCommand.infraService.interface.ts
                                           listInstalledCommands: which commands are on PATH
      desktopNotification.infraService.interface.ts
                                           notifyOnDesktop: the system's own notification, whose Open opens a link;
                                           DesktopNotificationRequest
      progress.infraService.interface.ts   withSourceControlProgress
      workspace.infraService.interface.ts  listWorkspaceFolderProjects, workspaceFolderChanges,
                                           showOnlyProjectFolder, removeProjectFolder, takeSessionToReopen;
                                           WorkspaceFolderProject, NoSessionToReopenError
      git.infraService.interface.ts        getStagedDiff, setCommitMessageInput, commit,
                                           openInSourceControl
      commitCli.infraService.interface.ts  generateCommitMessage; CommitMessageRequest
      settings.config.interface.ts         readSettings, readSessionSettings, readAlertSettings,
                                           saveDefaultAgentId; Settings, SessionSettings, AlertSettings
    utils/sessionQuestion.utils.ts         makeStopAgentsQuestion, makeArchiveQuestion: the questions that stopping
                                           or archiving an agent asks, worded for one agent or several, and for a
                                           turn cut short
  infrastructure/
    database/models/                       a Drizzle table per file (SessionTableModel...); base.model.ts:
                                           BASE_COLUMNS, the shared columns
    repositories/
      base/                                makeBaseRepository: the base calls on one table, on Drizzle's query
                                           builder; its types in base.repository.type.ts; repository.utils.ts its
                                           helpers (formatCurrentTimestamp, encodeStoredColumns, findUniqueColumns,
                                           selectRows, watchDataVersionChanges); entityChange.utils.ts
                                           startEntityChangeFeed, which reads the rows written since its last check
      session.repository.ts                SessionRepository: sessions with their project's path
      project.repository.ts                ProjectRepository: projects
      agent.repository.ts                AgentRepository: the aggregorApp.agents setting, decoded with its
                                           defaults, read again when it changes
    services/
      os/shellCommand.infraService.ts      ShellCommandInfraService: looks commands up on PATH
      os/desktopNotification.infraService.ts
                                           DesktopNotificationInfraService: notify-send, filed under VS Code, on Linux,
                                           osascript on macOS, a PowerShell toast from WSL
      tmux/tmux.infraService.ts            TmuxInfraService: the command a session's tab runs, which starts its
                                           agent under aggregor-pty in a tmux session or attaches to it; stops it;
                                           reads which sessions tmux runs
      vscode/                              UserInputPromptInfraService, WorkspaceInfraService (also syncs the
                                           shown project's .vscode/settings.json with Aggregor's workspace file),
                                           GitInfraService, ProgressInfraService
      vscode/terminal/                     TerminalInfraService: session tabs, each a tmux client attached to its
                                           agent, and project shells; terminal.utils finds a tab's session id in
                                           its env
      commitCli/                           CommitCliInfraService: runs the configured commit command
    config/settings.config.ts              SettingsConfig
    di/
      app.layer.ts                         AppLayer: the layer graph under the commands and views
      database.layer.ts                    DatabaseLayer: opens ~/.aggregor/data/aggregor.db, foreign keys on, and
                                           applies the migrations in assets/migrations it hasn't run
    logger/traceLog.layer.ts               TraceLogLayer
    utils/aggregorFolder.utils.ts          getAggregorFolderPath: ~/.aggregor, or $AGGREGOR_HOME (~/.aggregorDev
                                           from F5); readAbsolutePathVariable
    utils/anchorFolder.utils.ts            getAnchorFolderPath: anchor/Aggregor in it, the hidden folder 0 of the
                                           window once it shows one project
    utils/database.utils.ts                getDatabaseFilePath: data/aggregor.db in it, or $AGGREGOR_DATABASE_FILE;
                                           the window opens it, and aggregor-pty writes to it.
                                           applyPendingMigrations: backs the database up, then runs a folder's
                                           migrations it hasn't
    utils/tmuxSocket.utils.ts              getTmuxSocketPath: tmux.sock in it, Aggregor's own tmux server
  presentation/
    routes.ts                              RoutesLayer: each command's ID, controller and presenter; Open Settings
                                           goes straight to @pkg/vscode
    middlewares/registerCommand.middleware.ts
                                           registerCommand: root span per command; shows the presenter's message
                                           for a failure, and logs a crash
    controllers/                           session, agent, sessionAlert, project, commitMessage: decode the input into a
                                           request DTO and call one service; the views' reads
    presenters/                            session, project, commitMessage: a failed command's message, and the
                                           setting that fixes it; app: none, for commands that cannot fail
    views/sessions/                        SessionsView (sessions.view.ts): the webview view provider, the webview's
                                           messages and the commands it asks for; sessionsDrawing.utils.ts what it
                                           sends apps/webview (the Sessions and Archive lists' rows and their
                                           changes, the installed agents, the view's badge, each list's count of
                                           sessions waiting on the user, the look); sessionsPage.utils.ts the page (its HTML and content security
                                           policy) and the agent icons' webview URIs; sessions.view.type.ts the
                                           messages both ways, which apps/webview imports
    views/sessionAlerts/                   SessionAlertsView: shows each alert in the focused window or hands it to
                                           the system, and handles the session links desktop notifications open
  extension.ts                             activate
apps/extension/tests/
  migrations.test.ts                       every migration on a new database, and on a filled one at each earlier
                                           migration (see Tables and migrations)
```

## Domain model

- An entity is a `Schema.Class` of domain types, and its `.entity.ts` exports only that class: a rule about one entity
  is a method on it. A rule across entities, or one that needs facts from outside the entity, lives in a
  `.domainService.ts` (`getDefaultSessionName`, `getSessionStatus`), whose every export is an `Effect.fn`, so each rule
  shows up in a trace. Lint (`no-restricted-syntax`) checks both files' exports.
- Every entity stored in the database extends `BaseEntity` (`id`, `sortId`, `updatedAt`, `deletedAt`), and its
  repository and entity service build on the base pieces: `makeBaseRepository` and `base.service.ts`. Rows reach the
  domain only through `BaseEntity.fromRow`, inside the base repository, so no entity knows how it is stored.
  `AgentEntity` lives in the user's settings instead, so it is a plain `Schema.Class` whose id is its settings key.
- `EntityIdValueObject`, `ProjectPathValueObject` and `AgentIdValueObject` are branded with `Schema.brand`; a value
  object that is a set of values (`AgentStatusValueObject`, `SessionStatusValueObject`, `StatusKindValueObject`,
  `EntityChangeKindValueObject`) is a `Schema.Enum` with UPPER_CASE keys, and its file exports the values beside the
  schema as an UPPER_CASE constant (`export const AGENT_STATUSES = AgentStatusValueObjectSchema.enums`), the one copy of
  each string. Code elsewhere imports that constant (`AGENT_STATUSES.WORKING`) and never reads `.enums` itself.
  Presentation, which can't import the domain, compares none: it looks states up in its constants. Lint
  (`syntaxBans.ts`) bans `Schema.Literals` in a value object, an enum value object without its exported constant,
  reading `.enums` outside value objects, and comparing with a state, kind-of-wait or kind-of-change string;
  `roleNames.ts` lets a value object export the UPPER_CASE constant.
- Each value object exports its schema as `<Name>ValueObjectSchema` and its type as `<Name>ValueObject`, since lint's
  `no-redeclare` rejects a value and a type of the same name. Entities and errors are classes, which are both.
- A Schema class (entity or error) takes a `{readonly brand: unique symbol}` type argument, so two classes with the same
  fields stay distinct types; Effect's `schemaClassMissingBrand` checks it.
- A brand is created only at the edge: repositories decode what is stored, controllers decode their input into request
  DTOs, infra services decode file names and CLI output, and a value the edge produces itself (a new UUID, a path VS
  Code hands over) goes through the schema's `make`, which checks it the same way.
- Lint bans casts (`@typescript-eslint/consistent-type-assertions`, `assertionStyle: "never"`); `as const` stays
  allowed.
- Maps and errors are keyed by brands: `ReadonlyMap<EntityIdValueObject, Terminal>`,
  `TerminalNotFoundError({sessionId})`.

## Application

- An application service is a file of use cases, one per entity or feature, as long as its use cases need: commands
  (`newSession`), queries that return response DTOs (`getSessionListItem`), and the work that runs for the window's life
  (`startSessionTitleSync`). A use case takes a request DTO, and turns entities into response DTOs before they leave it.
- A use case asks the user nothing: its request DTO carries every choice (the project, the agent, the name), and the
  front end asks for them and confirms what needs confirming before it sends the request. Add Project, which needs the
  system's folder dialog that a webview can't open, asks through `IUserInputPromptInfraService`. A use case shows
  progress through `IProgressInfraService`. It returns every failure the user should hear about as a typed error, for
  presentation to show; a cancelled dialog or a row removed meanwhile is not a failure, so the use case ends quietly.
  Work no command started, such as the title sync, logs its failures.

## Presentation

- A command runs through `routes.ts` and `registerCommand` to its controller, which decodes what VS Code passed into the
  request DTO and calls one service. A failure the service returns goes to the command's presenter, and the middleware
  shows the presenter's message; the presenter's type covers every failure its services return, so a new one fails to
  compile until it has a message. A command that only drives VS Code and reads no data, Open Settings, goes straight to
  its `@pkg/vscode` helper, with no controller or service.
- A view registers VS Code's providers and draws what its controllers return. It assembles nothing: a list arrives whole
  from one use case (`listProjectsWithSessions` returns each project's row with its sessions' rows), and the view adds
  only what VS Code alone can make, such as an agent icon's webview URI.
- The Sessions view is a webview: the view reads the lists through its controllers and sends them to `apps/webview`,
  which keeps the rows it was sent and draws them. The webview asks the view to run a command on a row with the row's
  key as the request DTO's own field, `{sessionId}` or `{projectPath}`, and the view runs it with `executeCommand` when
  `SESSIONS_WEBVIEW_COMMANDS` lists it, so it takes the menus' path: its route, `registerCommand` and its controller,
  which decodes that argument into the request DTO.
- The webview asks the user before it sends a request: it picks the project and the agent for New Session, the name for
  Rename, and confirms Remove on a running agent and Stop on a turn in progress, from the rows and the agent list the
  view sent it. Its dialogs are its own; no layer below waits on the user.
- Every command runs from the webview, the Source Control button or a notification; none is in the Command Palette.
- A display preference only the view uses, `aggregorApp.fontSize`, `aggregorApp.accentColor` and
  `aggregorApp.skipAgentPicker`, the view reads itself through `VsCodeApi`, as it draws, rather than through a
  controller and a service, since no use case needs it.
- The view redraws only what changed: `watchSessionListChanges` sends `ProjectListChanged` (every project),
  `ProjectSessionsChanged` (one project's sessions) or `SessionChanged` (one session). The view sends the webview what
  changed in the Sessions list, one session's row in either list, and the Archive whole for any change but a session's
  own, since its project rows come and go with their archived sessions.
- Text, symbols and colours for a status are the view's: `STATUS_LABELS` and `STATUS_KIND_LABELS` in
  `@pkg/constants/src/sessionsView.constant.ts`, and the webview's status icons; the status itself is the backend's.
  Which actions a row's menu offers the webview picks from the row's DTO (`canMoveUp`, `isAgentRunning`, `isArchived`,
  `isAdded`), as the manifest's `when` clauses did for the tree.

## Errors

- An error is a `Schema.TaggedError` class whose name ends in `Error`. It sits at the top of a file, after the imports
  and the types that stand alone, above the file's other classes; there are no `.error.ts` files. Lint
  (`no-restricted-syntax`) checks the placement, the name and the missing `.error.ts` files, and
  `perfectionist/sort-modules` keeps errors above other classes.
- An error lives in the highest layer that raises or handles it. One that an interface's signature names, because a
  layer above catches it, sits in that interface's file: `interfaces/terminal.infraService.interface.ts` holds
  `TerminalNotFoundError`, which `SessionService.openSession` answers by relaunching. Any other sits in the file that
  raises it: `NoProjectError` in `project.service.ts`, `SessionTitleNotFoundError` in `session.domainService.ts`.
- An error is exported only when another file imports it or names it in an exported function's type.
  `RemoveCancelledError` in `session.service.ts` is private, and `TerminalInfraService` keeps private the reasons no
  session is in view, which it reports through the interface as one `NoViewedSessionError`.
- The message a user sees is presentation's: a presenter maps each tag to a text from `@pkg/constants`, and to the
  setting that fixes it when there is one, which the middleware opens from the error's Open Settings button.

## Dependency injection

- **Interface:** a `Context.Service` class named `I<Name>` in a `.interface.ts` file: repositories next to their entity
  in `domain/entities`, the rest in `application/interfaces`. It has no static `layer`. Its key is the package name, the
  file's path under `src` and the class name
  (`aggregor-app/application/interfaces/terminal.infraService.interface/ITerminalInfraService`), which Effect's
  `deterministicKeys` checks.
- **Implementation:** a `Layer` exported from `infrastructure`, named after its interface without the `I`, such as
  `SessionRepository` or `TerminalInfraService`. The backend shows in the folder (`services/vscode/`), not the name.
- **Container:** `infrastructure/di/app.layer.ts` merges the layers into `AppLayer`; `extension.ts` puts the commands
  and views on top, with the trace log and `VsCodeApi` underneath. There is no resolver and there are no string tokens:
  a use case's type lists the interfaces it needs, so a missing layer is a compile error.
- **Agents are data, not implementations:** each is an `aggregorApp.agents` entry that `IAgentRepository` reads, so a
  new agent CLI is a settings entry, not code. The domain's `prepareLaunchPlan` turns an agent and a session into a
  `LaunchPlanValueObject`, and the tmux infra service runs it under `aggregor-pty` in the session's tmux session;
  neither knows the other.
- **The agent and its tab are apart:** `ITmuxInfraService` starts and stops agents and says which run;
  `ITerminalInfraService` only opens, focuses, names and closes the tabs attached to them.
- **Planned with their roadmap items:** a `Hosts` LayerMap keyed by host id for SSH, and a worktree infra service for
  M3.

## Repositories, models and transformers

- Every repository is `makeBaseRepository` on its table, spread into its own object with its own queries. Writes are
  column-scoped: `update` sets only the columns it is given, so the extension and `aggregor-pty` never overwrite each
  other's columns.
- The database is the only copy of the data: every read is a query, and no repository, service or view keeps rows. Each
  repository's `entityChanges` streams every write to its table as an `EntityChange` (placed, updated, removed): after
  the window's own writes at once, and after another connection's (`aggregor-pty`, another window) once
  `PRAGMA data_version` moves, which is polled every 250 ms, untraced. Each check reads the rows whose `updatedAt` is at
  or after the last one it read, skips those it already read unchanged at that instant, and counts a row placed (new, or
  moved by `placeAtEnd`) when its `sortId` is above every one it saw.
- Each table model is a Drizzle `sqliteTable` that spreads `BASE_COLUMNS`; its unique columns are what `upsert` matches
  on. A repository passes `makeBaseRepository` a join for the columns it reads from the rows it points at, such as a
  session's `projectPath`. After changing a model, `pnpm db:generate --name <change>` writes its migration (see Tables
  and migrations). `storage.md` lists every stored table and key.
- `AgentRepository` reads VS Code's settings, not a table: it decodes `aggregorApp.agents` when the window starts and
  again each time the setting changes, so an invalid entry is warned about once per change, and keeps the result for its
  reads.
- A transformer turns an outside format into domain types (none today: `aggregor-pty` writes the domain's own values).
  It sits beside the infra service that reads the format, since only infrastructure knows it.

## Tables and migrations

- **One column per dimension.** A column holds one thing about its row that changes on its own, and one program writes
  it: the extension or `aggregor-pty`, never both.
  - Settings are the exception: a project's settings are one JSON text column, `settings`, read and written whole by the
    extension and decoded by `ProjectSettingsValueObject`, whose every key has a default and falls back to it when a
    stored value no longer decodes. A new setting is a schema field, not a migration; the repository stores an object
    column as its JSON text.
  - A stage a row moves through, such as an agent's status, is one text column backed by an enum value object, even with
    two values, rather than a boolean per stage. Each action checks the stage it starts from and ends quietly when the
    row is already where the action would move it. A row's context value carries its stage, so the menus offer only what
    that stage allows. Once a stage has a third value, the moves between its values go into one transition map in the
    domain service, which every move checks.
  - Booleans about the same thing, ones that rule each other out or one that only matters while another holds, merge
    into that thing's stage column.
  - Things that change independently stay in their own columns, even when each is a yes or a no: merged, every action
    has to handle every combination (an agent's 7 statuses, worked or not, and a third yes-or-no make 28 values), and
    two programs end up writing one column.
  - A boolean column is for a yes-or-no fact that is not a stage and can't grow a third value: a session's `hasWorked`,
    which `aggregor-pty` sets once, and a project's `isAdded`.
- **Every schema change is a migration on the user's database.** `pnpm db:generate --name <change>` writes the next one
  into `apps/extension/assets/migrations/`; read its SQL before committing it. A user's database is never regenerated or
  deleted.
  - When a window starts, `DatabaseLayer` runs the migrations the database hasn't run, matched by name, in one
    transaction with foreign keys off, so a failed one leaves the database as it was and the extension fails to start.
    The transaction holds SQLite's write lock from before the backup to the last migration, so a second window starting
    at once waits, up to the client's 5-second busy timeout, and then finds nothing to run.
  - Before an existing database runs a migration, it is copied beside itself as `aggregor.before-<migration>.db`, by
    `VACUUM INTO` on a second, read-only connection, or by copying its file and write-ahead log when that fails; only
    the latest copy is kept. When neither copy works, a warning is logged and the migrations still run.
  - A release's migration only adds: tables, and columns that are nullable or have a default. Renaming or dropping a
    column takes two releases, one that adds the new column and copies the data into it, and a later one that drops the
    old one: windows not yet reloaded, and `aggregor-pty` processes still running in tmux from the older build, keep
    writing the old column in between.
  - A migration that moves data, such as filling a new column from old ones, gets its SQL added to the generated file,
    or a file of its own from `drizzle-kit generate --custom`, and its own check in the migration test.
  - A released migration is never edited: a database that ran it doesn't run it again.
- **Migrations are tested.** `apps/extension/tests/migrations.test.ts` (`pnpm test`) runs every migration on a new
  database. For each migration it also builds a database at that one, fills every table from SQLite's own description of
  it (a row with every column set, and one with only the required ones), migrates it to the newest, and checks that
  every table, row and value is still there, that each new column holds its default, that SQLite finds the database
  intact with every foreign key resolving, that the backup holds every row from before and replaced the older one, and
  that migrating again changes nothing. `pnpm db:check` fails when a table model changed without its migration. CI runs
  both. Before releasing a migration, run the build against a copy of a real database (`AGGREGOR_DATABASE_FILE`) and
  check that every project and session still shows.

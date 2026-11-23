# DDD

How `apps/extension/src` is layered: where each kind of code goes, what it is named, and the lint that checks both.
Every file but `extension.ts` sits in one of four layers, and its name says which role it plays there. A change that
moves where code goes updates this file in the same commit.

## Concepts

The building blocks, as Evans (_Domain-Driven Design Reference_), Vernon (_Implementing Domain-Driven Design_, ch. 14)
and Martin (_The Clean Architecture_) define them, and where each sits here.

- **Entity:** an object "distinguished by its identity, rather than its attributes", whose identity runs through time:
  `SessionEntity`, `ProjectEntity`, `ReviewCommentEntity`, `AgentEntity`. Each entity is its own aggregate root.
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
- **Error message:** turns a failure a use case returns into the message the user reads.
- **View:** draws response DTOs with VS Code's APIs, or sends them to a webview that draws them. It has its own things
  (badges, the webview's page and messages) and decides nothing about the data.

## Layers

```text
┌──────────────────────────────── packages ────────────────────────────────┐
│ @pkg/constants  every constant outside the domain, one file a feature    │
│ @pkg/vscode     VsCodeApi (the one runtime `vscode` import), VscodeUtils │
│                 (the vscode helpers and argument decoding)               │

│ @pkg/errors     TaggedErrors: builds a file's errors as one class        │
└─────────▲──────────────── shared by FE and infra ────────────▲───────────┘
┌─ presentation (FE) ┴───────────────────────┐                 │
│ views       draw DTOs: trees, webviews     │                 │
│ controllers input → request DTO → service  │                 │
│ errorMessages failure → message            │                 │
│ middlewares                                │                 │
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

| Layer             | Holds                                                                                     | May import                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `domain/`         | Entities, value objects, domain services, repository interfaces and their errors          | `effect`, `@pkg/errors`' `TaggedErrors`, domain                                                                               |
| `application/`    | Services (the use cases), DTOs, the interfaces of the infra services and config they use  | `effect`, `@pkg/constants`, `@pkg/errors`' `TaggedErrors`, domain, application                                                |
| `infrastructure/` | Models, repositories, infra services, config, the layer graph, the trace log              | `effect`, `@effect/*`, `drizzle-orm`, `jsonc-parser`, `vscode` types, `node:*`, `@pkg/*`, domain, application, infrastructure |
| `presentation/`   | Controllers, which register their commands, the command middleware, error messages, views | `effect`, `vscode` types, `@pkg/*`, and from the layers below only services and DTOs, each part as listed below               |
| `extension.ts`    | `activate`: builds the runtime from the layer graph                                       | everything                                                                                                                    |

- Dependencies point inward. Application declares the interfaces it needs, infrastructure implements them, and
  application never imports infrastructure.
- Interfaces speak only domain types and DTOs, never `Memento`, `Terminal` or other `vscode` types.
- `@pkg/vscode`'s `vscode.api.ts` holds the one runtime import of `vscode`; everything else yields `VsCodeApi`.
  Infrastructure and presentation import only `vscode`'s types, and application and domain never see it.
- Presentation imports nothing from the domain or infrastructure. What it shares with infrastructure (VsCodeApi, the
  vscode helpers, argument decoding) lives in `@pkg/vscode`; constants live in `@pkg/constants`.
- Within presentation:
  - **Controllers** import `@/services`, `@/dtos`, `@/middlewares` and `@/errorMessages`, to register their commands,
    `@pkg/constants`, `@pkg/errors`' `TaggedErrors` and `@pkg/vscode`'s `vscode.utils.ts`, whose `VscodeUtils` decodes
    their input and opens the settings for Open Settings, which has no use case.
  - **Error messages** import `@pkg/constants`, `@pkg/errors`' `TaggedErrors`, and `@/services` for types only.
  - **Views** import `@/controllers`, their own files, `@pkg/*`, and `@/dtos` for types only.
  - **Middlewares** import `@/middlewares` and `@pkg/*`: a middleware runs inside the controller that calls it, which
    hands it everything else.
- `presentation/` lives inside `src`, because the extension ships as one bundle. The Sessions view's webview is the
  exception: `apps/webview` draws it, in VS Code's page, apart from the extension, and follows the folder-structure
  skill instead of these layers. It imports only the view's `.view.type.ts` and DTOs, for types only (lint rejects a
  value import), `@pkg/constants`, and its design system, `@pkg/ui`; its build lands in the extension's `dist/webview`.

Each folder directly under a layer has one import alias under `@/` in `apps/extension/tsconfig.json`. The webview's
tsconfig maps `@/dtos`, `@/valueObjects` and `@/views` to the same folders, so its own `src` has no folders by those
names:

| Layer            | Aliases                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `domain`         | `@/domainServices` (`services`), `@/entities`, `@/valueObjects`                                                                            |
| `application`    | `@/interfaces`, `@/services`, `@/dtos`                                                                                                     |
| `infrastructure` | `@/config`, `@/models` (`database/models`), `@/di`, `@/logger`, `@/repositories`, `@/infraServices` (`services`), `@/infraUtils` (`utils`) |
| `presentation`   | `@/controllers`, `@/errorMessages`, `@/middlewares`, `@/views`                                                                             |

Code is imported only through them, so each file has one import path, and by name: lint (`no-restricted-syntax`) bans
`import * as`, `vscode` included. `packages/lint/src/layers/importRules.ts` checks the import columns with a
typescript-eslint's `no-restricted-imports` (run by oxlint as `typescript-js/no-restricted-imports`) regex allow-list
per folder (`IMPORT_RULES`: each layer, then presentation's controllers, error messages and views), which also rejects
relative imports.

## Naming

Each file's suffix names its role, each role lives in one layer, and the file's main names carry the role.
`packages/lint/src/layers/roleNames.ts` checks the names with typescript-eslint's `naming-convention`, one block per
file suffix. A function's name starts with a verb that says what it does (`makeSessionRow`, `decodeStoredRow`,
`runWithSourceControlProgress`): `VERB_FIRST_NAME_BANS` in `syntaxBans.ts` fails a name that starts with `to`, `as`,
`from`, `with`, `of` or `into`, and a function whose name starts with `new`.

| Role                    | Layer                             | File                                                    | Names                                              |
| ----------------------- | --------------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| Entity                  | domain                            | `entities/<x>/<x>.entity.ts`                            | `SessionEntity`                                    |
| Value object            | domain                            | `valueObjects/<x>.valueObject.ts`                       | `EntityIdValueObject`, `EntityIdValueObjectSchema` |
| Repository interface    | domain                            | `entities/<x>/<x>.repository.interface.ts`              | `ISessionRepository`                               |
| Domain service          | domain                            | `services/<x>.domainService.ts`                         | `SessionDomainService`                             |
| Application service     | application                       | `services/<x>.service.ts`                               | `SessionService`, `BaseService`                    |
| DTO                     | application                       | `dtos/<x>.dto.ts`                                       | `SessionListItemDto`, `SessionListItemDtoSchema`   |
| Infra service interface | application                       | `interfaces/<x>.infraService.interface.ts`              | `ITerminalInfraService`                            |
| Config interface        | application                       | `interfaces/<x>.config.interface.ts`                    | `ISettingsConfig`                                  |
| Repository              | infrastructure                    | `repositories/<x>.repository.ts`                        | `SessionRepository`, `BaseRepository`              |
| Model                   | infrastructure                    | `database/models/<x>.model.ts`                          | `SessionTableModel`, `BASE_COLUMNS`                |
| Infra service           | infrastructure                    | `services/<backend>/<x>.infraService.ts`                | `TerminalInfraService`                             |
| Transformer             | infrastructure                    | `services/<backend>/<x>.transformer.ts`                 | `GitHubCliTransformer`                             |
| Config                  | infrastructure                    | `config/<x>.config.ts`                                  | `SettingsConfig`                                   |
| Layer                   | infrastructure                    | `di/<x>.layer.ts`, `logger/<x>.layer.ts`                | `ApplicationLayer`, `DatabaseLayer`, `Database`    |
| Controller              | presentation                      | `controllers/<x>.controller.ts`                         | `SessionController`                                |
| Error message           | presentation                      | `errorMessages/<x>.errorMessage.ts`                     | `SessionErrorMessage`                              |
| Middleware              | presentation                      | `middlewares/<x>.middleware.ts`                         | `RegisterCommandMiddleware`                        |
| View                    | presentation                      | `views/<x>/<x>.view.ts`                                 | `SessionsView`                                     |
| Helpers                 | any                               | `utils/<x>.utils.ts`, or beside the one file they serve | `TerminalUtils`                                    |
| Shared types            | any                               | `<declaring file>.type.ts`, beside it                   | plain names                                        |
| Errors                  | the highest layer that handles it | one class at the top of a file (see Errors)             | `SessionServiceErrors`                             |

- File and folder names are camelCase in every dotted part, as in `terminal.infraService.type.ts`;
  `unicorn/filename-case` checks them everywhere but `.claude`, whose skill folders follow Claude Code's names.
- An implementation's file is its interface's file without `.interface`, so a search for `terminal.infraService` finds
  the interface, with its errors and types, and its implementation.
- `I` marks only our interfaces: the ports, `Context.Service` classes in `.interface.ts` files, and `IBaseRepository`,
  the shape every repository interface extends, and the errors classes named after them (`ITerminalInfraServiceErrors`,
  `IBaseRepositoryErrors`). A unit's class is named its file's owner, which `roleNames.ts` checks for every role that
  holds functions, and a file's errors class its owner plus `Errors`; a layer file's exported layer ends in `Layer`.
  Data shapes take no prefix.
- A type that stands alone sits at the top of a file, right after the imports. A type built from a value of its own
  file, directly or through another such type, sits below what it is built from, so the file reads top down: a value
  object's or DTO's type right after its schema (`AgentListItemDtoSchema`, then `AgentListItemDto`), an error union
  after its errors class. An interface's own types (its inputs, which end in `Request`, and `Settings`) sit in its
  `.interface.ts`. Types several implementation files share live in a `.type.ts`, which holds nothing else.
  `aggregor/type-placement` (`packages/lint/src/rules/`) checks where types sit, and `no-restricted-syntax` the rest.
- A DTO is a `Schema.Struct` (or `TaggedUnion`), so a controller validates its input by decoding into it. A request DTO
  is `<UseCase>RequestDto`, one per use case; a response DTO is named for what it is to the user (`SessionListItemDto`).
- A controller function is named for its input, or for its caller when the caller is a view: `removeChosenSession`,
  `newSessionAskingForProject`, `generateCommitMessageForSourceControl`, `getSessionListItemForSessionsView`.
- A `.type.ts` file sits beside the file that declares it, so its interface or implementation is the file next to it.
- Files that share their first dotted part sit in a folder of that name, as in `views/sessions/` and
  `entities/session/`; files with different first parts stay flat, as in `services/`, `interfaces/` and `valueObjects/`.
- Every file with a role owns its spans, and the owner is its file name: a config, controller, domain service, error
  message, infra service, middleware, repository, service, transformer, utils or view file (`terminal.utils.ts` is
  `TerminalUtils`), and a layer file without the suffix (`backgroundJobs.layer.ts` is `BackgroundJobs`). A span is named
  in one of two ways: a class's `make` is `<Owner>.make`, and every other `Effect.fn`, each a const inside a `make`, is
  `<Owner>.<const>`, its class and then its const, so the trace log prints `SessionService.openSession` as the source
  writes it. A command's root span is its command ID.
- The aggregor plugin (`packages/lint/src/rules/`, one file per rule) checks the span names and that each unit's class
  is named after its file, the `.type.ts` placement, the stem folders, where constants live, that a comment is one line,
  and each function's length (`max-lines-per-function`, ESLint's own with a unit's `make` exempt); it fixes span names;
  for `apps/webview`, it also checks the folder-structure skill's rules (`packages/lint/src/folderStructure/`).
- A constant lives in `@pkg/constants/src/<feature>.constant.ts`: ids, labels and texts, and also file and folder names,
  environment variables, external commands, VS Code's and other extensions' ids, timings and patterns. Constants that
  describe one thing share an object with a label per value (`TMUX.SOCKET_FILE_NAME`, `SESSIONS_VIEW.ID`). The domain,
  which can't import `@pkg/constants`, keeps its patterns beside its rules, and a model's `BASE_COLUMNS` is code. Not
  constants: log messages, which read beside their code, and the arguments of a command line being built.
  `aggregor/constant-placement` flags a module-level const named in UPPER_CASE, or set to a bare literal, anywhere else
  in the extension and `@pkg/vscode`.
- A constant holds no logic: it is a literal, or a text with holes, an arrow whose whole body is one template literal
  (`` (displayName) => `${displayName} finished` ``). A text that depends on a case is one constant per case, and a util
  beside the code that uses it picks one, as an error message does for a failure's text. Lint (`CONSTANT_BANS` in
  `syntaxBans.ts`) bans conditions, calls, spreads and operators in `@pkg/constants`, and any other function there.
- An aggregate of several entities would get an `.aggregate.ts`.

## Tree

```text
packages/
  constants/src/                           one file per feature, each with its command ids, labels, notices, error
                                           texts and the feature's other constants: app, commitMessage, database,
                                           git, agent, process, project, reviewComment, session, sessionAlert,
                                           sessionsView, terminal, tmux, vscode (VS Code's own command ids),
                                           workspace
  errors/src/taggedErrors.utils.ts         TaggedErrors: a file's errors as the keys of one class, each keeping its
                                           own tag and type, built when the file loads
  lint/src/                                the repo's lint setup: base/ per file type, layers/ the DDD layering
                                           checks, folderStructure/ apps/webview's checks, rules/ the aggregor
                                           plugin (one file per rule), and lint.config.ts, oxlint's config

  ui/src/                                  apps/webview's design system: theme.css (shadcn's tokens and the status
                                           colours from VS Code's theme) and components/base/, shadcn's components
                                           on Base UI, which shadcn's CLI writes (components.json)
  vscode/src/
    vscode.api.ts                          VsCodeApi: the only runtime import of vscode, and the extension's id
    vscode.utils.ts                        VscodeUtils: acquireScopedDisposable, streamVsCodeEvent,
                                           setWhenClauseContextKey, runWithProgressIndicator,
                                           openAggregorSettingsInSettingsEditor, showErrorNotificationWithoutWaiting
                                           (with an Open Settings button when given a setting), decodeVsCodeArgument;
                                           InvalidVsCodeArgumentError
apps/extension/src/
  domain/
    entities/
      base/
        base.entity.ts                     BaseEntity (Schema.Class: id, sortId, updatedAt, deletedAt; decodeStoredRow, the
                                           factory every stored row goes through)
        base.repository.interface.ts       IBaseRepository<Entity, AddRequest>: add, findById, findMany, findPage,
                                           update, upsert, softDelete, placeAtEnd, entityChanges; EntityChange,
                                           EntityPage; DatabaseReadError, DatabaseWriteError, EntityNotFoundError
      session/
        session.entity.ts                  SessionEntity (BaseEntity and projectId, projectPath, name, customName,
                                           agentId, viewedAt, lifecycle, and aggregor-pty's status, statusKind,
                                           statusMessage, statusProgress, statusChangedAt, hasWorked, reportedTitle,
                                           tasks, terminalTitle and agentSessionId, worktreePath, baseBranchName, runState;
                                           displayName, and workingFolderPath: its worktree, or else its project's
                                           root)
        session.repository.interface.ts    ISessionRepository: the base calls
      project/
        project.entity.ts                  ProjectEntity (BaseEntity and path, isAdded, settings)
        project.repository.interface.ts    IProjectRepository: the base calls
      reviewComment/
        reviewComment.entity.ts            ReviewCommentEntity (BaseEntity and filePath, startLine, endLine, body;
                                           lineRange: its lines as a prompt cites them)
        reviewComment.repository.interface.ts
                                           IReviewCommentRepository: the base calls
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
                                           default), SessionWorkingTreeValueObject (literals: projectRoot, worktree),
                                           SessionRunStateValueObject (literals: running, interrupted),
                                           PullRequestStateValueObject (literals: open, draft, merged, closed),
                                           AgentTaskValueObject (an OSC 7501 record with an id),
                                           AgentTaskStateValueObject (literals: a task's states),
                                           AgentTaskKindValueObject (literals: subAgent, shell, remoteAgent,
                                           teammate, workflow, monitor, mcpTask, other),
                                           PaginationValueObject (one page of a list: its size and the cursor it
                                           follows, its number, the total pages and rows, the rows before and after
                                           it, the next cursor)
    services/
      session.domainService.ts             prepareLaunchPlan, getDefaultSessionName, getSessionTitle,
                                           getSessionTitleToSave, getSessionTasks, getSessionStatus,
                                           isSessionTurnRunning, getAlertedStatus, isSessionWaitingOnUser
      entityId.domainService.ts            makeEntityId, getEntityIdCreatedAt: the entity id's factory
      sortOrder.domainService.ts           findEntityIdsToPlaceAtEnd, canMoveUpInOrder, canMoveDownInOrder: how
                                           rows move within an order
      pagination.domainService.ts          makePagination: what a page is, from its request and the row counts
      worktree.domainService.ts            getWorktreeName, getWorktreeBranchName, getWorktreesFolderName,
                                           getTitledBranchName, hasWorktreeBranchFirstName, formatTextAsNamePart: what a
                                           session's worktree, its branch and its project's worktrees folder are
                                           called
      folderShell.domainService.ts         getFolderShellName: what a folder's shell is called in tmux
      agentTask.domainService.ts           getAgentTaskKind: what an agent's task is, from its id
      reviewComment.domainService.ts       findReviewCommentsInFolder, formatReviewPrompt: which review comments a
                                           folder holds, and how they read in an agent's prompt
  application/
    services/
      base.service.ts                      BaseService.makeFor(repository): addEntity, findEntityById,
                                           findEntities, findEntityPage, updateEntity, upsertEntity, removeEntity,
                                           placeEntitiesAtEnd, bound to one repository
      session.service.ts                   createSession (in a project, with an agent or the default one, at the
                                           project's root, in a new worktree or in an existing one),
                                           openSession, archiveSession,
                                           unarchiveSession, removeSession,
                                           renameSession, renameSessionBranch, stopSessionAgent, stopProjectSessionAgents,
                                           stopArchivedProjectSessionAgents, stopOngoingSessionAgents,
                                           stopArchivedSessionAgents, moveSessionUp, moveSessionDown (each session
                                           moves among its project's sessions in its own list);
                                           the lists: listProjectsWithSessions and listProjectsWithArchivedSessions
                                           (each project with its sessions' rows), getProjectSessions,
                                           getSessionListItem,
                                           watchSessionListChanges, watchViewedSessionIds, findViewedSessionId,
                                           listSessionsWaitingOnUser (the badge and each view's count);
                                           startSessionTitleSync, startSessionTabNameSync, startViewedAtSync,
                                           startRunStateSync, syncSessionTabsWithTmux
      agent.service.ts                     listAgents (the installed agents, the default first), setDefaultAgent,
                                           findAgentToStart; NoAgentInstalledError
      sessionAlert.service.ts              watchSessionAlerts: the states sessions out of view hold for 3 seconds,
                                           as notifyOn picks them; notifyOnDesktop
      project.service.ts                   listProjects, getProjectListItem, findProjectListItem, addProject
                                           (asks for folders), addProjectPaths, findOrAddProject, removeProject,
                                           moveProjectUp, moveProjectDown, saveProjectSettings;
                                           ProjectNotListedError
      folderShell.service.ts               openProjectTerminal, openSessionFolderTerminal (a row's Open Terminal:
                                           the window's Aggregor terminal on the shell of the project's folder, or
                                           of the session's), prepareSessionFolderShellRequest (the session's
                                           shell and its label), syncFolderShellTerminalWithTmux,
                                           startFolderShellEndOnTerminalClose
      pullRequest.service.ts               openSessionPullRequest, signInToGitHubCli, watchGitHubCliSignedOut,
                                           startPullRequestRefreshOnTurnEnd
      sessionImport.service.ts             listImportableSessions (each agent's conversations in a project's folder
                                           and in its worktrees that aren't sessions yet), importSessions
      requiredTools.service.ts             watchMissingTools: tmux and gh checked at start and after the setup
                                           terminal closes; installRequiredTools; NoPackageManagerError
      worktree.service.ts                  listProjectLeftovers, cleanUpProjectLeftovers (a project's worktrees and
                                           aggregor/* branches left over), hasProjectLeftovers (its row's dot),
                                           removeSessionWorktree (Remove's first step); LeftoversKeptError
      commitMessage.service.ts             generateCommitMessage: writes the message with Source Control's progress
      sessionProcess.service.ts            watchSessionProcesses: what each open dropdown's agent terminal and folder
                                           shell run, read every 2 seconds while it is open
      workspace.service.ts                 startShownProjectSync: the viewed session's project as the only
                                           project folder; startSessionReopenAfterReload
      reviewComment.service.ts             listReviewComments, watchReviewCommentChanges, addReviewComment,
                                           editReviewComment, moveReviewComment (a thread's new lines),
                                           removeReviewComment, sendReviewComments (pastes the comments under the
                                           folder of the session last in view into its agent's prompt, removes them
                                           and opens the session) and sendSessionReviewComments (the same for the
                                           session whose row asked); NoReviewCommentsError,
                                           NoSessionForReviewCommentsError, SessionAgentNotRunningError,
                                           SessionNotShownError
    dtos/
      session.dto.ts                       SessionListItemDto, ProjectSessionsDto (a project's row with its sessions'
                                           rows, and its worktrees in the Sessions list), WorktreeListItemDto,
                                           SessionListChangeDto, and a request DTO per session use case
      sessionAlert.dto.ts                  SessionAlertDto, NotifyOnDesktopRequestDto
      agent.dto.ts                         AgentListItemDto: a row of the agent picker; SetDefaultAgentRequestDto
      project.dto.ts                       ProjectListItemDto with its ProjectSettingsDto, and a request DTO per
                                           project use case
      folderShell.dto.ts                   OpenProjectTerminalRequestDto, OpenSessionFolderTerminalRequestDto
      pullRequest.dto.ts                   OpenSessionPullRequestRequestDto
      requiredTools.dto.ts                 MissingToolsDto with its MissingToolDto
      sessionImport.dto.ts                 ImportableSessionsDto (AgentImportableSessionsDto, ImportableSessionDto
                                           with the worktree it ran in), ImportSessionsRequestDto with its
                                           ImportedSessionDto
      worktree.dto.ts                      ProjectLeftoversDto (LeftoverWorktreeDto, LeftoverBranchDto), and a
                                           request DTO per worktree use case
      commitMessage.dto.ts                 GenerateCommitMessageRequestDto
      sessionProcess.dto.ts                SessionProcessesDto (TerminalProcessesDto, FolderShellProcessesDto,
                                           SessionProcessDto),
                                           WatchSessionProcessesRequestDto
      reviewComment.dto.ts                 ReviewCommentDto, ReviewCommentChangeDto, and a request DTO per review
                                           comment use case
    interfaces/                            each with the errors and types its signatures name
      terminal.infraService.interface.ts   openSessionTerminal, focusSessionTerminal, closeSessionTerminal,
                                           closeOtherSessionTerminals, findOpenSessionTerminalProcessId,
                                           assignShownSessions,
                                           openFolderShellTerminal, findFolderShellTerminalProcessId,
                                           assignShownFolderShellPath, folderShellPathsClosedByUser,
                                           nameActiveSessionTab, activatedSessionIds, viewedSessionId,
                                           openSetupTerminal, closedSetupTerminals;
                                           FolderShellTerminalRequest, SessionTabRequest, TerminalCommand,
                                           TerminalLaunchFailedError, NoSessionTabOpenError,
                                           NoFolderShellTerminalOpenError
      tmux.infraService.interface.ts       checkTmuxVersion; for a session's agent: prepareSessionTabCommand,
                                           waitForSessionAgentStart, stopSessionAgent, pasteTextIntoSessionAgent,
                                           runningSessionIds,
                                           refreshRunningSessionIds, startedOrStoppedSessionIds, showSessionInTab,
                                           readShownSessionIdsByTabProcessId; for a folder's shell:
                                           prepareFolderShellTerminalCommand, showFolderShellInTerminal,
                                           readFolderShellPathShownInTerminal, endFolderShell; readSessionAgentPanes,
                                           readFolderShellPanes;
                                           SessionTabCommandRequest, FolderShellRequest, TmuxSessionPanes,
                                           TmuxSessionNotRunningError, PtyBinaryNotFoundError,
                                           TmuxUnavailableError, SessionTabSwitchFailedError,
                                           FolderShellSwitchFailedError, FolderShellNotShownError
      userInputPrompt.infraService.interface.ts
                                           pickProjectFolderPaths: the system's folder dialog;
                                           FolderPickCancelledError
      shellCommand.infraService.interface.ts
                                           listInstalledCommands: which commands are on PATH
      process.infraService.interface.ts    listGroupProcesses: the processes under some roots;
                                           ProcessGroupRequest, RunningProcess
      desktopNotification.infraService.interface.ts
                                           notifyOnDesktop: the system's own notification, whose Open opens a link;
                                           DesktopNotificationRequest
      progress.infraService.interface.ts   runWithSourceControlProgress
      workspace.infraService.interface.ts  listWorkspaceFolderProjects, workspaceFolderChanges,
                                           showOnlyProjectFolder, removeProjectFolder, takeSessionToReopen;
                                           WorkspaceFolderProject, NoSessionToReopenError
      git.infraService.interface.ts        getStagedDiff, setCommitMessageInput, commit,
                                           openInSourceControl
      worktree.infraService.interface.ts   createWorktree, listWorktrees, copyIncludedFiles, readBranchName,
                                           hasUpstream, findFreeBranchName, renameBranch, hasChanges,
                                           removeWorktree, isMadeByAggregor, listAggregorBranches, pruneRemote,
                                           findBaseBranch, isBranchMerged, deleteBranch,
                                           findWorktreesRootPath, readDiffStats; GitWorktree,
                                           WorktreeBranch, WorktreeDiffStats, NotGitRepositoryError, WorktreeCreateFailedError,
                                           BranchRenameFailedError, WorktreeHasChangesError,
                                           WorktreeRemoveFailedError, BranchDeleteFailedError
      commitCli.infraService.interface.ts  generateCommitMessage; CommitMessageRequest
      agentHistory.infraService.interface.ts
                                           listAgentConversations; AgentConversation, AgentHistoryNotReadError,
                                           AgentHistoryReadFailedError
      gitHubCli.infraService.interface.ts  findPullRequest, refreshPullRequest, pullRequestChangedFolderPaths,
                                           gitHubCliSignedOutProblems, openPullRequestInBrowser,
                                           openPullRequestInVsCode; PullRequestBranch, BranchPullRequest,
                                           GitHubCliSignedOutError, PullRequestNotFoundError
      settings.config.interface.ts         readSettings, readSessionSettings, readAlertSettings,
                                           saveDefaultAgentId; Settings, SessionSettings, AlertSettings
  infrastructure/
    database/models/                       a Drizzle table per file (SessionTableModel...); base.model.ts:
                                           BASE_COLUMNS, the shared columns
    repositories/
      base/                                BaseRepository.makeFor(entityTable): the base calls on one table, on
                                           Drizzle's query builder; its types in base.repository.type.ts;
                                           RepositoryUtils its helpers (formatCurrentTimestamp, encodeStoredColumns,
                                           findUniqueColumns, makeFilterClauses, selectRows, selectRowPage,
                                           countRows, watchDataVersionChanges); EntityChangeUtils
                                           startEntityChangeFeed, which reads the rows written since its last check
      session.repository.ts                SessionRepository: sessions with their project's path
      project.repository.ts                ProjectRepository: projects
      reviewComment.repository.ts          ReviewCommentRepository: the review comments not sent yet
      agent.repository.ts                AgentRepository: the aggregorApp.agents setting, decoded with its
                                           defaults, read again when it changes
    services/
      git/worktree.infraService.ts         WorktreeInfraService: worktrees and their branches on the git command
                                           line: add, list, remove, rename, merge checks and deletion, and the
                                           untracked files a new worktree gets
      os/shellCommand.infraService.ts      ShellCommandInfraService: looks commands up on PATH
      process/                             ProcessInfraService (process.infraService.ts): psProcess.utils.ts lists
                                           every process with one ps call, linuxProcess.utils.ts picks a pane's
                                           cgroup, processTree.utils.ts a root's descendants
      os/desktopNotification.infraService.ts
                                           DesktopNotificationInfraService: notify-send, filed under VS Code, on Linux,
                                           osascript on macOS, a PowerShell toast from WSL
      tmux/                                TmuxInfraService (tmux.infraService.ts): the layer, and what its helper
                                           files share in tmux.infraService.type.ts. tmuxServer.utils.ts is tmux
                                           itself, in tmux's own terms: runs a command on Aggregor's server, lists
                                           its sessions, clients and a session's panes, attaches a terminal's
                                           client to another session, kills a session, pastes a text into a
                                           session's pane, and builds the command a terminal runs, in a scope of
                                           its own. On top of it, sessionAgent.utils.ts: the command a
                                           session's tab runs, which starts its agent under aggregor-pty in a tmux
                                           session or attaches to it; stops it; pastes a text into its prompt;
                                           attaches a tab to another session; reads which sessions tmux runs and
                                           which one each tab shows. And
                                           folderShell.utils.ts: the command the window's Aggregor terminal runs,
                                           which starts a folder's shell in a tmux session or attaches to it;
                                           attaches the terminal to another folder's shell, started first with the
                                           shown shell's variables; ends one; reads which folder's shell the
                                           terminal shows
      vscode/                              UserInputPromptInfraService, WorkspaceInfraService (also syncs the
                                           shown project's .vscode/settings.json with Aggregor's workspace file),
                                           GitInfraService, ProgressInfraService
      vscode/terminal/                     TerminalInfraService: session tabs, each a tmux client attached to its
                                           agent, the window's one Aggregor terminal, a tmux client attached to a
                                           folder's shell, and the setup terminal that installs tools;
                                           terminal.utils finds a tab's session id in its env and pins a tab;
                                           folderShellTerminal.utils opens the Aggregor terminal, finds it by its
                                           env, and says which folder's shell it showed when the user closed it
      agentHistory/                        AgentHistoryInfraService: a folder's conversations from each agent's own
                                           store, read-only; a <agent>History.utils.ts per agent (Claude Code,
                                           Codex, OpenCode, Copilot), on what agentHistory.utils.ts shares
      commitCli/                           CommitCliInfraService: runs the configured commit command
      gitHubCli/                           GitHubCliInfraService: each worktree branch's pull request from gh, cached and
                                           looked up in the background, again when the setup terminal closes;
                                           GitHubCliTransformer (gitHubCli.transformer.ts) reads gh's JSON
    config/settings.config.ts              SettingsConfig
    di/
      app.layer.ts                         DomainLayer (the domain services), InfrastructureLayer (every port's
                                           implementation) and ApplicationLayer (the application services and the
                                           background jobs), each merged under its level's span
      backgroundJobs.layer.ts              BackgroundJobs: its make starts every background job an application
                                           service runs, syncSessionTabsWithTmux first, then the rest together
      database.layer.ts                    Database (openDatabaseFile, migrateDatabase) and DatabaseLayer, built from
                                           them: opens ~/.aggregor/data/aggregor.db, foreign keys on, and applies the
                                           migrations in assets/migrations it hasn't run
    logger/traceLog.layer.ts               TraceLog, and TraceLogLayer built from it: the span lines, the output
                                           channel's logger and the trace logging setting
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
    middlewares/registerCommand.middleware.ts
                                           RegisterCommandMiddleware.registerCommand: root span per command; shows
                                           the failure's message, and logs a crash
    controllers/                           session, sessionImport, sessionProcess, agent, sessionAlert, project,
                                           folderShell, worktree, pullRequest, requiredTools, commitMessage,
                                           reviewComment: each
                                           registers its commands, decodes a command's input into a request DTO and
                                           calls one service; the views' reads. app: Open Settings, which goes
                                           straight to @pkg/vscode
    errorMessages/                         session, sessionImport, project, folderShell, worktree, pullRequest,
                                           requiredTools, commitMessage, reviewComment: a failed command's message,
                                           and the setting
                                           that fixes it; app: none, for commands that cannot fail
    views/sessions/                        SessionsView (sessions.view.ts): the webview view provider, the webview's
                                           messages and the commands it asks for; sessionsDrawing.utils.ts what it
                                           sends apps/webview (the Sessions and Archive lists' rows and their
                                           changes, the installed agents, the view's badge, each list's count of
                                           sessions waiting on the user, the look); sessionsPage.utils.ts the page (its HTML and content security
                                           policy) and the agent icons' webview URIs; sessions.view.type.ts the
                                           messages both ways, which apps/webview imports
    views/sessionAlerts/                   SessionAlertsView: shows each alert in the focused window or hands it to
                                           the system, and handles the session links desktop notifications open
    views/gitHubCliNotices/                GitHubCliNoticesView: the notice that gh is signed out, with its Sign In
                                           button
    views/requiredToolsNotices/            RequiredToolsNoticesView: the notice that tmux or gh is missing, with its
                                           Install button, or each tool's install page
    views/folderShellProfile/              FolderShellProfileView: the Aggregor terminal profile's provider, which
                                           VS Code calls for every terminal it opens itself in Aggregor's workspace
    views/reviewComments/                  ReviewCommentsView: the comment controller, a thread per review comment
                                           not sent yet, which it moves with its file's edits and whose new lines it
                                           then saves, and the commands that need VS Code's draft thread or a
                                           comment's editing mode
  extension.ts                             PresentationLayer: the controllers and views, merged under its span, on
                                           ApplicationLayer; activate, deactivate
apps/extension/tests/
  migrations.test.ts                       every migration on a new database, and on a filled one at each earlier
                                           migration (see Tables and migrations)
```

## Domain model

- An entity is a `Schema.Class` of domain types, and its `.entity.ts` exports only that class: a rule about one entity
  is a method on it. A rule across entities, or one that needs facts from outside the entity, lives in a domain service,
  a unit such as `SessionDomainService` (`getDefaultSessionName`, `getSessionStatus`), so each rule shows up in a trace.
  Lint (`no-restricted-syntax`) checks the entity file's exports.
- Every entity stored in the database extends `BaseEntity` (`id`, `sortId`, `updatedAt`, `deletedAt`), and its
  repository and entity service build on the base pieces: `BaseRepository` and `BaseService`. Rows reach the domain only
  through `BaseEntity.decodeStoredRow`, inside the base repository, so no entity knows how it is stored. `AgentEntity`
  lives in the user's settings instead, so it is a plain `Schema.Class` whose id is its settings key.
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
  `no-redeclare` rejects a value and a type of the same name. Entities and a file's errors class are classes, which are
  both.
- An entity takes a `{readonly brand: unique symbol}` type argument, so two classes with the same fields stay distinct
  types; Effect's `schemaClassMissingBrand` checks it. An error takes none: its tag keeps it apart from every other.
- A brand is created only at the edge: repositories decode what is stored, controllers decode their input into request
  DTOs, infra services decode file names and CLI output, and a value the edge produces itself (a new UUID, a path VS
  Code hands over) goes through the schema's `make`, which checks it the same way.
- Lint bans casts (`@typescript-eslint/consistent-type-assertions`, `assertionStyle: "never"`); `as const` stays
  allowed.
- Maps and errors are keyed by brands: `ReadonlyMap<EntityIdValueObject, Terminal>`,
  `ITerminalInfraServiceErrors.TerminalNotFoundError.make({sessionId})`.

## Application

- An application service is a unit of use cases, one per entity or feature, as long as its use cases need: commands
  (`createSession`), queries that return response DTOs (`getSessionListItem`), and the work that runs for the window's
  life (`startSessionTitleSync`). A use case takes a request DTO, and turns entities into response DTOs before they
  leave it.
- A use case asks the user nothing: its request DTO carries every choice (the project, the agent, the name), and the
  front end asks for them and confirms what needs confirming before it sends the request. Add Project, which needs the
  system's folder dialog that a webview can't open, asks through `IUserInputPromptInfraService`. A use case shows
  progress through `IProgressInfraService`. It returns every failure the user should hear about as a typed error, for
  presentation to show; a cancelled dialog or a row removed meanwhile is not a failure, so the use case ends quietly.
  Work no command started, such as the title sync, logs its failures.

## Presentation

- A controller registers its own commands in its `make`, each with `RegisterCommandMiddleware`'s `registerCommand` and
  its error message's function, so its layer is all a command needs. A command runs through `registerCommand` to its
  controller, which decodes what VS Code passed into the request DTO and calls one service. A failure the service
  returns goes to the command's error message, and the middleware shows it (`CommandErrorMessage`); the error message's
  type covers every failure its services return, so a new one fails to compile until it has a message. A command that
  only drives VS Code and reads no data, Open Settings, has no service: `AppController` calls `VscodeUtils`' helper.
- A view registers VS Code's providers and draws what its controllers return. It assembles nothing: a list arrives whole
  from one use case (`listProjectsWithSessions` returns each project's row with its sessions' rows), and the view adds
  only what VS Code alone can make, such as an agent icon's webview URI.
- The Sessions view is a webview: the view reads the lists through its controllers and sends them to `apps/webview`,
  which keeps the rows it was sent and draws them. The webview asks the view to run a command on a row with the row's
  key as the request DTO's own field, `{sessionId}` or `{projectPath}`, and the view runs it with `executeCommand` when
  `SESSIONS_WEBVIEW_COMMANDS` lists it, so it takes the menus' path: `registerCommand` and its controller, which decodes
  that argument into the request DTO.
- The webview asks the user before it sends a request: it picks the project and the agent for New Session, the name for
  Rename, and confirms Remove on a running agent and Stop on a turn in progress, from the rows and the agent list the
  view sent it. Its dialogs are its own; no layer below waits on the user.
- Every command runs from the webview, the Source Control button, a notification or a comment thread's buttons. Only
  Send Comments to Session is in the Command Palette, with a keybinding.
- A button VS Code draws in a menu of its own runs a controller's command with the object VS Code hands it, which the
  controller decodes as it does a webview's request: Source Control's button, and a comment's Save, Delete and Send
  Comments to Session. When the gesture needs more of VS Code's object than reading it (a draft thread to dispose, a
  comment's editing mode), the view registers the command, does that part, and runs the controller's command with a
  complete request, as the Sessions view does for its webview: `ReviewCommentsView`'s Add Comment, Edit and Cancel
  (`REVIEW_COMMENTS_VIEW_GESTURES`). The view draws nothing from its own gesture: the saved comment comes back through
  `watchReviewCommentChanges`, which every window draws from. What only a view can see and a use case needs, such as the
  lines a comment's thread has moved to, the view reports through a controller's command, so the database holds it and
  no other view has to ask this one.
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

- A file's errors are the keys of one class, its owner plus `Errors`, which extends `TaggedErrors({...})` from
  `@pkg/errors` (`packages/errors/src/taggedErrors.utils.ts`): one object from each error's tag to its fields, its keys
  ending in `Error` in alphabetical order, and an empty class body. `session.service.ts` holds `SessionServiceErrors`,
  `terminal.infraService.interface.ts` `ITerminalInfraServiceErrors`, and `base.repository.interface.ts`, which has no
  class, `IBaseRepositoryErrors`. A comment about an error sits above its key.
- An error is made as `ITmuxInfraServiceErrors.TmuxUnavailableError.make({})` and named in a type as
  `ITmuxInfraServiceErrors["TmuxUnavailableError"]`, several of one file as
  `ITmuxInfraServiceErrors["TmuxSessionNotRunningError" | "TmuxUnavailableError"]`. Each keeps its own tag and type, so
  a signature says which errors a function can fail with, `Effect.catchTag` clears a handled one from the type, and an
  error message's table fails the typecheck when a tag has no branch. Its `_tag` and its `name` are its key; the class
  behind it has another name at run time.
- The errors class sits at the top of its file, after the imports and the types that stand alone, above the file's other
  classes; there are no `.error.ts` files. It can't be a static of the unit's own class: `make` raises the unit's errors
  inside that class's base expression, which TypeScript rejects (TS2506). Lint fails a `Schema.TaggedError` class in the
  extension's source, its tests or `@pkg/vscode`, and checks that a `TaggedErrors` class is named `…Errors`, has an
  empty body and keys ending in `Error`, is the only one in its file and comes before the file's other classes.
- An error lives in the highest layer that raises or handles it. One that an interface's signature names, because a
  layer above catches it, sits in that interface's errors class: `ITerminalInfraServiceErrors` holds
  `TerminalNotFoundError`, which `SessionService.openSession` answers by relaunching. Any other sits in the errors class
  of the file that raises it: `ProjectNotListedError` in `project.service.ts`, `SessionTitleNotFoundError` in
  `session.domainService.ts`.
- A file's errors class is exported only when another file uses it, so a file's errors are exported or private together.
  `TerminalInfraService`'s own `TerminalInfraServiceErrors`, the reasons no session is in view, is not exported: it
  reports them through the interface as one `NoViewedSessionError`.
- The message a user sees is presentation's: an error message maps each tag to a text from `@pkg/constants`, and to the
  setting that fixes it when there is one, which the middleware opens from the error's Open Settings button.

## Dependency injection

- **Interface:** a `Context.Service` class named `I<Name>` in a `.interface.ts` file: repositories next to their entity
  in `domain/entities`, the rest in `application/interfaces`. It has no static `layer`. Its key is the package name, the
  file's path under `src` and the class name
  (`aggregor-app/application/interfaces/terminal.infraService.interface/ITerminalInfraService`), which Effect's
  `deterministicKeys` checks.
- **Unit:** every file that holds functions exports one `Context.Service` class, in the form Effect's docs use, and
  every function is a const inside its `make`:
  `class SessionService extends Context.Service<SessionService>()("<key>", {make: Effect.fn("SessionService.make")(…)})`
  with `public static readonly layer = Layer.effect(this, this.make())`. `make` yields the unit's dependencies once, at
  its top, holds every function of the unit as a const, and returns the ones callers use, `{}` for a view or
  `BackgroundJobs`, which nothing calls; a member that takes no arguments is an `Effect`, built once. A function inside
  `make` yields no service, so nothing a unit does needs anything from its caller. A long `make` is fine; a class is
  divided where its parts clearly belong apart. Only `activate` and `deactivate`, which VS Code calls directly, and
  `TaggedErrors`, which builds a file's errors class when the file loads, outside any effect, are plain functions; a
  file that holds only definitions (value objects, entities, DTOs, ports, table models, types) has no unit class.
- **Implementation:** a port's implementation is a class named after its interface without the `I`, such as
  `SessionRepository` or `TerminalInfraService`, whose layer provides the port:
  `Layer.effect(ITerminalInfraService, this.make())`. Nothing yields the implementation class itself. The backend shows
  in the folder (`services/vscode/`), not the name, and the port class stays in its `.interface.ts`.
- **Base classes:** `BaseService` and `BaseRepository` each have one member, `makeFor`, which binds a repository or an
  entity table and returns the base functions, each named `BaseService.…` or `BaseRepository.…` like any other function
  of its class. A service or repository yields the class at the top of its `make`, calls `makeFor` there
  (`const projectBaseService = yield* baseService.makeFor(projectRepository)`), and its layer provides the base class's.
- **Nothing is passed as a dependency:** no function takes a service, a ref or a `…Dependencies` object as a parameter.
  State, such as a `Ref` or a cache, lives in the `make` of the unit whose functions own it, and another unit that needs
  it yields that unit and calls its members.
- **An implementation gives itself what it is built from**, in its own file, with `Layer.provide`, which hides it from
  whoever uses the implementation: Node's services (`NodeServices.layer`), the database (`DatabaseLayer`, through
  `BaseRepository`) or its own utils. No implementation needs another port. A unit's layer gives it the units of its own
  level that it yields: `SessionController.layer` provides `SessionErrorMessage.layer` and
  `RegisterCommandMiddleware.layer`, `TmuxInfraService` its tmux utils, and `SessionsPageUtils` the `SecureRandom` its
  page's nonce needs. It never provides a unit of a lower level.
- **Two things are global:** `VsCodeApi`, which `activate` builds from its argument, and the trace log, which sits under
  everything so that startup is traced. `extension.ts` provides both once.
- **Levels:** `infrastructure/di/app.layer.ts` holds `DomainLayer`, `InfrastructureLayer` and `ApplicationLayer`, and
  `extension.ts` holds `PresentationLayer`, each
  `Layer.mergeAll(...).pipe(Layer.withSpan("<Level>"), Layer.provide(<the levels below>))`: the domain is given
  `SecureRandom`, infrastructure the domain and `@pkg/vscode`'s `VscodeUtils`, the application services the domain,
  infrastructure and Node's services, for `Path`, and presentation `ApplicationLayer` and `VscodeUtils`. The trace log,
  under everything, provides `VscodeUtils` to itself; a layer is built once however many levels name it. Lint bans
  `Layer.provideMerge` in both files, so a level never hands on what it was given. Startup nests under `Domain`,
  `Infrastructure`, `Application` and `Presentation` in the trace log.
- **Container:** `InfrastructureLayer` puts the implementations side by side, so none is built with another in reach,
  and fails to compile when one leaves more than `VsCodeApi` open. There is no resolver and there are no string tokens:
  a unit's layer lists the interfaces it leaves open, so a missing layer is a compile error.
- **Background jobs start in one place:** `BackgroundJobs`' `make` (`infrastructure/di/backgroundJobs.layer.ts`) starts
  every job an application service runs for the window's life, `sessionService.syncSessionTabsWithTmux` first, then the
  rest together. `ApplicationLayer` merges `BackgroundJobs.layer`, so every job has started before a command or view
  exists. A watcher an implementation or a view runs starts in its own `make`. `decisions/backgroundJobs.md` lists them
  all.
- **A unit's spans carry its name:** every `Effect.fn` is named `<Owner>.<const>` in the source, and a class's `make`
  `<Owner>.make`; `aggregor/span-name` checks each name and that the class is named after its file, and `pnpm lint:fix`
  writes the names. Nothing is added while the extension runs, so a call into a unit is a plain call. The name is part
  of the function, so an effect, a stream or a callback handed to another unit keeps it: `CommitMessageService`'s
  `writeCommitMessage`, which `VscodeUtils.runWithProgressIndicator` runs, prints as
  `CommitMessageService.writeCommitMessage`, and a command handler's spans stay its controller's although
  `RegisterCommandMiddleware` runs it. A library's span keeps the name its library gave it (`sqlite`), under the span of
  the unit that ran it. In a failure's stack the frame for a call into a unit is the calling line.
- **Startup order is a dependency:** layers side by side are built at the same time, so a layer that must start after
  another is given it. `BaseRepository` is given `DatabaseLayer`, the SQL client with its migrations already run, and
  the commands and views are given all of `ApplicationLayer`.
- **Agents are data, not implementations:** each is an `aggregorApp.agents` entry that `IAgentRepository` reads, so a
  new agent CLI is a settings entry, not code. The domain's `prepareLaunchPlan` turns an agent and a session into a
  `LaunchPlanValueObject`, and the tmux infra service runs it under `aggregor-pty` in the session's tmux session;
  neither knows the other.
- **What runs in tmux and its terminal are apart:** `ITmuxInfraService` starts and stops agents and folder shells and
  says which run; `ITerminalInfraService` only opens, focuses, names, pins and closes the terminals attached to them.
  Neither calls the other: where a step needs both, as when the shared tab switches session or the Aggregor terminal
  switches folder, the use case hands the terminal's process id, which is its tmux client's, from one to the other. The
  application names a folder's shell by its folder's path; only `TmuxInfraService` knows its tmux session's name, which
  the domain's `getFolderShellName` gives.
- **tmux in tmux's terms, under what runs on it:** inside `infrastructure/services/tmux/`, `tmuxServer.utils.ts` knows
  tmux and nothing of Aggregor (sessions by name, clients by their terminal's process id), and `sessionAgent.utils.ts`
  and `folderShell.utils.ts` each say what one kind of tmux session is. A new kind of thing in tmux is a new file beside
  them, and a new tmux command goes into `tmuxServer.utils.ts`.
- **Worktrees on the git command line:** `IWorktreeInfraService` runs `git worktree` itself rather than through the Git
  extension, whose API reaches only repositories open in Source Control.
- **Planned with their roadmap items:** a `Hosts` LayerMap keyed by host id for SSH.

## Repositories, models and transformers

- Every repository is `BaseRepository.makeFor` on its table, with its own queries beside the base calls. Writes are
  column-scoped: `update` sets only the columns it is given, so the extension and `aggregor-pty` never overwrite each
  other's columns.
- The database is the only copy of the data: every read is a query, and no repository, service or view keeps rows. Each
  repository's `entityChanges` streams every write to its table as an `EntityChange` (placed, updated, removed): after
  the window's own writes at once, and after another connection's (`aggregor-pty`, another window) once
  `PRAGMA data_version` moves, which is polled every 250 ms, untraced. Each check reads the rows whose `updatedAt` is at
  or after the last one it read, skips those it already read unchanged at that instant, and counts a row placed (new, or
  moved by `placeAtEnd`) when its `sortId` is above every one it saw.
- Each table model is a Drizzle `sqliteTable` that spreads `BASE_COLUMNS`; its unique columns are what `upsert` matches
  on. A repository passes `makeFor` a join for the columns it reads from the rows it points at, such as a session's
  `projectPath`. After changing a model, `pnpm db:generate --name <change>` writes its migration (see Tables and
  migrations). `storage.md` lists every stored table and key.
- A list read a page at a time goes through `findPage(filter, pageRequest)`: newest first (highest `sortId` first), the
  rows after the request's cursor, at most its page size, with a `PaginationValueObject` that `makePagination` works out
  from two counts, the rows in all and the rows before the page. The cursor is the page's last row's `sortId`, opaque
  outside the repository, so a row placed meanwhile shifts no page after it. A use case that shows several pages reads
  them one cursor after the other.
- `AgentRepository` reads VS Code's settings, not a table: it decodes `aggregorApp.agents` when the window starts and
  again each time the setting changes, so an invalid entry is warned about once per change, and keeps the result for its
  reads.
- A transformer turns an outside format into what its port returns: `GitHubCliTransformer` reads gh's JSON.
  `aggregor-pty` writes the domain's own values, so its rows need none. A transformer sits beside the infra service that
  reads the format, since only infrastructure knows it.

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

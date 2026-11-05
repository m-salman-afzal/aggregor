# DDD plan

Status: done. Every step of the `ddd` stack has landed: `domain/` holds the entities, value objects and repository
interfaces, `application/` the use cases behind the interfaces of the infra services and config they need,
`infrastructure/` VS Code's API, storage, logging, the implementations of those interfaces and the layer graph, and
`presentation/` the routes, controllers, the command middleware and the Sessions view. Every file but `extension.ts`
sits in a layer, and its name says which. Keep this file in step with the code whenever a change moves where code goes.

The layering follows vs-uc-api (a layered DDD Express API: `Domain`, `Application`, `Infrastructure`, plus `http/` for
presentation), adapted to Effect, with the places where vs-uc-api's layers leaked into each other fixed.

## Layers

| Layer             | Holds                                                                        | May import                                                                                   |
| ----------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `domain/`         | Entities, repository interfaces, value objects, repository errors            | `effect` only                                                                                |
| `application/`    | Services (the use cases), infra service and config interfaces, their errors  | `domain`, `@pkg/*`                                                                           |
| `infrastructure/` | VS Code's API, repositories, models, infra services, config, layers, logging | `domain`, `application` (to implement its interfaces), `vscode`, node, `@effect/*`, `@pkg/*` |
| `presentation/`   | Command routes, controllers, the command middleware, views                   | `application`, `domain`, `@pkg/*`, and from infrastructure only `vscode.api` and utils       |
| `extension.ts`    | `activate`: builds the runtime from the layer graph                          | everything                                                                                   |

Each folder directly under a layer has one import alias in `apps/extension/tsconfig.json`:

| Layer            | Aliases                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain`         | `@entities`, `@valueObjects`                                                                                                                      |
| `application`    | `@interfaces`, `@services`, `@appUtils`                                                                                                           |
| `infrastructure` | `@config`, `@models` (`database/models`), `@di`, `@logger`, `@repositories`, `@infraServices` (`services`), `@infraUtils` (`utils`), `@vscodeApi` |
| `presentation`   | `@controllers`, `@middlewares`, `@presentationUtils` (`utils`), `@views`                                                                          |

Code is imported only through them, so each file has one import path; `extension.ts` imports `./presentation/routes.ts`,
the one file at a layer's root. Lint enforces the import column with `@typescript-eslint/no-restricted-imports`: one
block per layer in `eslint.layers.ts`, with a regex allow-list over the aliases, which also rejects relative imports.
All four layers are enforced. Outside `infrastructure/vscode/vscode.api.ts`, `vscode` is a type-only import, and
`application` never sees it, not even its types.

## Naming

Each file's suffix names its role, each role lives in one layer, and the file's main names carry the role.
`eslint.layers.ts` checks the names with `@typescript-eslint/naming-convention`, one block per file suffix.

| Role                         | Layer                        | File                                           | Names                                                |
| ---------------------------- | ---------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| Entity                       | domain                       | `entities/<x>/<x>.entity.ts`                   | `SessionEntity`                                      |
| Value object                 | domain                       | `valueObjects/<x>.valueObject.ts`              | `SessionIdValueObject`, `SessionIdValueObjectSchema` |
| Repository interface         | domain                       | `entities/<x>/<x>.repository.interface.ts`     | `ISessionRepository`                                 |
| Application service          | application                  | `services/<x>.service.ts`                      | functions, imported as `SessionService`              |
| Infra service interface      | application                  | `interfaces/<x>.infraService.interface.ts`     | `ITerminalInfraService`                              |
| Config interface             | application                  | `interfaces/<x>.config.interface.ts`           | `ISettingsConfig`                                    |
| Repository                   | infrastructure               | `repositories/<x>.repository.ts`               | `SessionRepository`                                  |
| Infra service                | infrastructure               | `services/<backend>/<x>.infraService.ts`       | `TerminalInfraService`                               |
| Config                       | infrastructure               | `config/<x>.config.ts`                         | `SettingsConfig`                                     |
| Model                        | infrastructure               | `database/models/<x>.model.ts`                 | `StoredSessionsModel`                                |
| Layer                        | infrastructure               | `di/<x>.layer.ts`, `logger/<x>.layer.ts`       | `AppLayer`                                           |
| Controller, view, middleware | presentation                 | `.controller.ts`, `.view.ts`, `.middleware.ts` | `SessionController`, `SessionsView`                  |
| Error                        | its handler's layer          | the top of the file that declares it           | `SessionsCorruptError`                               |
| Shared types                 | infrastructure, presentation | `<declaring file>.type.ts`, beside it          | plain names                                          |

- File and folder names are camelCase in every dotted part, as in `claudeCodeHarness.infraService.type.ts`;
  `unicorn/filename-case` checks them everywhere but `.claude`, whose skill folders follow Claude Code's names.
- An implementation's file is its interface's file without `.interface`, so a search for `terminal.infraService` finds
  the interface, with its errors and types, and its implementation.
- `I` marks only our interfaces, the `Context.Service` classes, and lint keeps those in `.interface.ts` files. Data
  shapes take no prefix.
- Types and interfaces sit at the top of a file, right after the imports. An interface's own types (its inputs, which
  end in `Request`, and `Settings`) sit in its `.interface.ts`. Types several implementation files share live in a
  `.type.ts`, which holds nothing else; a value object's type stays with its value object, and an error union with its
  errors. Lint (`no-restricted-syntax`) checks all of it.
- Every `Effect.fn` span is named `<owner>.<const>`, the owner coming from the file name: `SessionService.openSession`,
  `SessionRepository.make`. A helper file belongs to the one owner in its folder (`claudeCodeHarness/status.utils.ts` to
  `ClaudeCodeHarnessInfraService`); a file with no owner gives the bare const name (`withHarnessInfraService`).
  `eslint.plugin.ts` checks every name and fixes it.
- Errors sit at the top of a file, after its imports and types (see Repositories and models for which file). There are
  no `.error.ts` files, and an error class's name ends in `Error`. Lint (`no-restricted-syntax`) checks all three, and
  `perfectionist/sort-modules` keeps a file's errors above its other classes.
- A `.type.ts` file sits beside the file that declares it, so its interface or implementation is the file next to it;
  `eslint.plugin.ts` checks that.
- Files that share their first dotted part sit in a folder of that name, as in `views/sessions/` and
  `entities/session/`; files with different first parts stay flat, as in `services/`, `interfaces/` and `valueObjects/`.
  `eslint.plugin.ts` checks it.
- Aggregates and domain services get `.aggregate.ts` and `.domainService.ts` once the first one exists. Today each
  entity is a one-entity aggregate root.

## From vs-uc-api to aggregor

| vs-uc-api                                         | aggregor                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Domain/Entities/<X>/{XEntity, IXRepository}`     | `domain/entities/<x>/{x.entity.ts, x.repository.interface.ts}`                                |
| `Domain/ValueObjects`                             | `domain/valueObjects/`, as branded or literal schemas                                         |
| `Domain/Transformers` (Drchrono data to ours)     | `<harness>.transformer.ts` (Claude Code formats to ours), beside the infra service reading it |
| `Domain/Validations`                              | none: decoding with Schema is the validation                                                  |
| `Application/<Feature>/<Feature>Service`          | `application/services/<feature>.service.ts`                                                   |
| `Application/<Feature>/Dtos`                      | none: controllers decode arguments into entities and branded ids                              |
| `Application/Utils`                               | `application/utils/`                                                                          |
| `Infrastructure/Database/Models`                  | `infrastructure/database/models/`: the versioned shapes kept in VS Code                       |
| `Infrastructure/Repository`, `MysqlRepository`    | `infrastructure/repositories/`, on VS Code's global and workspace state                       |
| `Infrastructure/Services/ThirdPartyClient/<X>`    | `infrastructure/services/<backend>/<x>.infraService.ts`                                       |
| `Infrastructure/DIContainer/{Container,Resolver}` | `infrastructure/di/`: a graph of Effect layers, no resolver                                   |
| `Infrastructure/{Logger,Config,Error,Utils}`      | `infrastructure/{logger,config,utils}/`; errors sit at the top of the file that declares them |
| `http/{Routes,Controllers,Middlewares,Sockets}`   | `presentation/{routes.ts,controllers/,middlewares/,views/}`                                   |
| `http/Server`                                     | `extension.ts`                                                                                |

## Tree

```text
apps/extension/src/
  domain/
    entities/
      session/
        session.entity.ts                  SessionEntity (Schema.Class: id, projectPath, name, harnessId),
                                           getNewSessionName, getUnreadSessionIds
        session.repository.interface.ts    ISessionRepository: sessions ref, modifySessions; SessionsCorruptError,
                                           SessionsSaveFailedError
      project/
        project.entity.ts                  ProjectEntity (Schema.Class: path, name, added)
        project.repository.interface.ts    IProjectRepository: addedProjectPaths ref, modifyAddedProjectPaths;
                                           ProjectsCorruptError, ProjectsSaveFailedError
    valueObjects/                          SessionIdValueObject, ProjectPathValueObject (branded), StatusValueObject,
                                           HarnessIdValueObject (literals), LaunchPlanValueObject (an interface)
  application/
    services/
      session.service.ts                   newSession, openSession, removeSession, listSessions, findSession,
                                           getSessionDisplayName
      project.service.ts                   listProjects, pickProject, addProject, removeProject; NoProjectError
      scm.service.ts                       writeCommitMessageOrShowError, offerToStageAllChanges,
                                           startSourceControlSync
    interfaces/                            each with the errors its signatures name
      harness.infraService.interface.ts    IHarnessInfraService: prepareLaunch, clearSessionStatus, getSessionTitle,
                                           sessionStatuses, sessionTitles, iconPath; IHarnessInfraServices: a LayerMap
                                           of them by harness id
      terminal.infraService.interface.ts   open, focus, close, isOpen, openSessionIds, activatedSessionIds,
                                           viewedSessionId; TerminalLaunchRequest
      prompt.infraService.interface.ts     showErrorMessage, confirm, pickProject, pickProjectFolderPaths
      workspace.infraService.interface.ts  listWorkspaceFolderProjects
      git.infraService.interface.ts        getStagedDiff, setCommitMessageInput, commit, stageAll, open or close in
                                           Source Control
      commitCli.infraService.interface.ts  generateCommitMessage; CommitMessageRequest
      settings.config.interface.ts         readSettings; Settings
    utils/                                 showErrorInBackground, withHarnessInfraService, forEachHarnessInfraService
  infrastructure/
    vscode/vscode.api.ts                   VsCodeApi: the only runtime import of vscode
    database/models/                       StoredSessionsModel v1, StoredAddedProjectPathsModel v1
    repositories/
      session.repository.ts                SessionRepository, on globalState: reloads on window focus
      project.repository.ts                ProjectRepository, on workspaceState
    services/
      claudeCodeHarness/                   ClaudeCodeHarnessInfraService: the `claude` launch plan, --settings hooks,
                                           the status env var, status-file and transcript watchers, and the
                                           transformer from Claude Code's formats to ours
      vscode/                              TerminalInfraService, PromptInfraService, WorkspaceInfraService,
                                           GitInfraService
      commitCli/                           CommitCliInfraService: runs the configured commit command
    config/settings.config.ts              SettingsConfig
    di/
      app.layer.ts                         AppLayer: the layer graph under the commands and views
      harnessInfraServices.layer.ts        HarnessInfraServicesLayer: LayerMap.fromRecord from harness id to its
                                           infra service
    logger/traceLog.layer.ts               TraceLogLayer
    utils/vscode.utils.ts                  acquireDisposable, fromEvent, setContext, withProgress
  presentation/
    routes.ts                              RoutesLayer: command ID to controller
    middlewares/registerCommand.middleware.ts
                                           registerCommand: root span per command, crash logging;
                                           InvalidCommandArgumentsError
    controllers/                           session, project: decode the tree-row arguments, call the service; scm:
                                           SourceControl to project path, progress, retry after Stage All
    utils/                                 decodeCommandArgument
    views/sessions/                        SessionsView: tree view, rows, badges, spinner
  extension.ts                             activate
```

The unread state stays with the view until the needs-input alerts (M2) need it too; only its rule moves to the entity.

## Dependency injection

- **Interface:** a `Context.Service` class named `I<Name>` in a `.interface.ts` file: repositories next to their entity
  in `domain/entities`, the rest in `application/interfaces`. It has no static `layer`.
- **Implementation:** a `Layer` exported from `infrastructure`, named after its interface without the `I`, such as
  `SessionRepository` or `TerminalInfraService`. The backend shows in the folder (`services/vscode/`), not the name.
  Harnesses are the exception, `ClaudeCodeHarnessInfraService`: the harness id is what tells them apart.
- **Container:** `infrastructure/di/app.layer.ts` merges the layers into `AppLayer`; `extension.ts` puts the commands
  and views on top, with the trace log and `VsCodeApi` underneath. There is no resolver: a use case's type lists the
  interfaces it needs, so a missing layer is a compile error. vs-uc-api's string tokens failed at runtime.
- **Several implementations at once:** `IHarnessInfraServices` (in `application/interfaces`) is a service holding a
  `LayerMap<HarnessIdValueObject, IHarnessInfraService>`; `infrastructure/di/harnessInfraServices.layer.ts` builds it
  with `LayerMap.fromRecord` over a record that `satisfies Record<HarnessIdValueObject, Layer<IHarnessInfraService>>`,
  so a harness id without an implementation fails to compile. Every harness starts with the window and never idles out,
  since the view reads its statuses all the time. Use cases run `withHarnessInfraService(session.harnessId, effect)`,
  and the view merges every harness's statuses and titles with `forEachHarnessInfraService`. A new harness is one
  `infrastructure/services/<harness>/` folder, with its infra service and transformer, and one record entry.
- **Harness and terminal don't know each other:** the harness returns a `LaunchPlanValueObject` (command, arguments,
  environment variables) and the terminal infra service runs it.
- **Later, with their roadmap items:** a `Hosts` LayerMap keyed by host id for SSH, a worktree infra service for M3, and
  tmux as a wrapper around the launch plan.

## Repositories and models

- Every window shares globalState, so a repository offers a read-modify-write (`modifySessions`) instead of `save`: it
  re-reads before each write, so no caller can drop another window's save or overwrite unreadable data.
- A model lists its own fields instead of embedding the entity, and the repository builds the entity from it. A new
  entity field then fails to compile in the repository, which is where the model's `version` bump belongs.
- An error lives in the highest layer that handles it, at the top of the file that declares it. One an interface's
  signature names, because a layer above catches it, sits in that interface's file:
  `interfaces/terminal.infraService.interface.ts` holds `TerminalNotFoundError`, which `SessionService.openSession`
  answers by relaunching. Any other sits in the file that raises it: `NoProjectError` in `project.service.ts`,
  `TranscriptNotFoundError` in `claudeCodeHarness/transcript.utils.ts`. It is exported only when another file catches or
  raises it; `TerminalInfraService`'s reasons no session is in view, which it reports through the interface as a single
  `NoViewedSessionError`, and `SessionNotFoundError` in `session.service.ts` are private.

## Branded types

- `SessionIdValueObject` and `ProjectPathValueObject` are branded with `Schema.brand`; `HarnessIdValueObject` and
  `StatusValueObject` are `Schema.Literals`. A session id is a UUID, so a file name or URI path that is not one is not
  ours.
- Each value object exports its schema as `<Name>ValueObjectSchema` and its type as `<Name>ValueObject`, since lint's
  `no-redeclare` rejects a value and a type of the same name. Entities are classes, which are both.
- A brand is created only at the edge: repositories decode what is stored, controllers decode command arguments, infra
  services decode file names and CLI output, and a value the edge produces itself (a new UUID, a path VS Code hands
  over) goes through the schema's `make`, which checks it the same way.
- Lint bans casts (`@typescript-eslint/consistent-type-assertions`, `assertionStyle: "never"`); `as const` stays
  allowed.
- Maps and errors are keyed by brands: `ReadonlyMap<SessionIdValueObject, Terminal>`,
  `TerminalNotFoundError({sessionId})`.

## Where this differs from vs-uc-api

1. Infra service and config interfaces live in `application/interfaces`, not next to their implementations in
   infrastructure, so application never imports infrastructure.
2. Interfaces speak only domain types, never `Memento`, `Terminal` or other vscode types. vs-uc-api's repository
   interfaces returned TypeORM models.
3. No resolver and no string tokens: typed Effect layers replace both.
4. No `Dtos/` or `Validations/` folders: Schema decoding does both jobs.
5. No `BaseService` or `BaseRepository`: nothing here needs generic create, read, update and delete.
6. Entities are Schema classes; normalization lives in Schema transforms, and rules are small functions on the entity
   instead of large services.
7. Transformers sit beside the infra service that reads the outside format, since only infrastructure knows it.
8. File and folder names are camelCase in every dotted part, and the suffix names the role (see Naming).
9. `presentation/` lives inside `src`, because the extension ships as one bundle.

## Stack

Each branch is verified in the headless VS Code (the `verify-in-vscode` skill).

0. `refactor/domain-layer` (done): entities, value objects with brands, transformers, domain errors, lint for domain,
   the cast ban. Sessions are stored under `storedSessions`, with `repoPath` and `harnessId`.
1. `refactor/infrastructure-layer` (done): `vscode.service`, database models, repositories behind the domain interfaces,
   logger, config, `di/`, lint for infrastructure and for type-only `vscode` imports.
2. `refactor/application-layer` (done): the session and repo use cases; the terminal, prompt and workspace client
   interfaces and their VS Code implementations; lint for application.
3. `refactor/scm-application` (done): the commit-message use case, the git client, the commit CLI, and settings behind
   an application interface.
4. `refactor/harness-client` (done): Claude Code behind `HarnessClient`, plus the `Harnesses` LayerMap and `LaunchPlan`;
   application and infrastructure no longer import `services/`.
5. `refactor/presentation-layer` (done): routes, controllers that decode their command arguments, the `registerCommand`
   middleware, views, lint for presentation.
6. `refactor/repo-to-project` (done): the domain's repo becomes a project, so "repository" only means a DDD repository
   or a git one. Commands, UI text, context values and storage keys follow; sessions are stored under `savedSessions`,
   with `projectPath`. Lint's abbreviation rule no longer allows `repo`.
7. `refactor/layer-naming` (done): a role suffix on every building block, `I` on interfaces, implementations named
   without their backend, errors and shared types in files named after what declares them, types above the code; lint
   checks all of it from `eslint.layers.ts`.
8. `refactor/service-span-names` (done): every span is named `<owner>.<const>` from its file name; errors sit at the top
   of the file that declares them, and an error no other file sees is private to it; an interface's types and errors sit
   in its `.interface.ts`; files sharing a first dotted part get a folder. `eslint.plugin.ts` checks the span names, the
   type files and the folders; `eslint.layers.ts` the errors.
9. `refactor/path-aliases` (done): one import alias per folder under a layer, such as `@entities` and `@infraServices`,
   in place of `@/` paths; the layers' import allow-lists are written over the aliases.

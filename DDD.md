# DDD

How `apps/extension/src` is layered: where each kind of code goes, what it is named, and the lint that checks both.
Every file but `extension.ts` sits in one of four layers, and its name says which role it plays there. A change that
moves where code goes updates this file in the same commit.

## Layers

| Layer             | Holds                                                                                     | May import                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `domain/`         | Entities, value objects, domain services, repository interfaces and their errors          | `effect`, domain                                                                                                         |
| `application/`    | Services (the use cases), the interfaces of the infra services and config they use, utils | `effect`, `@pkg/*`, domain, application                                                                                  |
| `infrastructure/` | `VsCodeApi`, models, repositories, infra services, config, the layer graph, the trace log | `effect`, `@effect/*`, `vscode`, `node:*`, `@pkg/*`, domain, application, infrastructure                                 |
| `presentation/`   | Command routes, controllers, the command middleware, views                                | `effect`, `vscode` types, `@pkg/*`, domain, application, presentation, and from infrastructure `vscode.api.ts` and utils |
| `extension.ts`    | `activate`: builds the runtime from the layer graph                                       | everything                                                                                                               |

- Dependencies point inward. Application declares the interfaces it needs, infrastructure implements them, and
  application never imports infrastructure.
- Interfaces speak only domain types, never `Memento`, `Terminal` or other `vscode` types.
- `infrastructure/vscode/vscode.api.ts` holds the one runtime import of `vscode`; everything else yields `VsCodeApi`.
  Infrastructure and presentation import only `vscode`'s types, and application and domain never see it.
- `presentation/` lives inside `src`, because the extension ships as one bundle.

Each folder directly under a layer has one import alias in `apps/extension/tsconfig.json`:

| Layer            | Aliases                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain`         | `@domainServices` (`services`), `@entities`, `@valueObjects`                                                                                      |
| `application`    | `@interfaces`, `@services`, `@appUtils`                                                                                                           |
| `infrastructure` | `@config`, `@models` (`database/models`), `@di`, `@logger`, `@repositories`, `@infraServices` (`services`), `@infraUtils` (`utils`), `@vscodeApi` |
| `presentation`   | `@controllers`, `@middlewares`, `@presentationUtils` (`utils`), `@views`                                                                          |

Code is imported only through them, so each file has one import path, and by name: lint (`no-restricted-syntax`) bans
`import * as`, `vscode` included; `extension.ts` imports `./presentation/routes.ts`, the one file at a layer's root.
`eslint.layers.ts` checks the import column with one `@typescript-eslint/no-restricted-imports` block per layer: a regex
allow-list over the aliases, which also rejects relative imports.

## Naming

Each file's suffix names its role, each role lives in one layer, and the file's main names carry the role.
`eslint.layers.ts` checks the names with `@typescript-eslint/naming-convention`, one block per file suffix.

| Role                    | Layer                             | File                                                    | Names                                                |
| ----------------------- | --------------------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Entity                  | domain                            | `entities/<x>/<x>.entity.ts`                            | `SessionEntity`                                      |
| Value object            | domain                            | `valueObjects/<x>.valueObject.ts`                       | `SessionIdValueObject`, `SessionIdValueObjectSchema` |
| Repository interface    | domain                            | `entities/<x>/<x>.repository.interface.ts`              | `ISessionRepository`                                 |
| Domain service          | domain                            | `services/<x>.domainService.ts`                         | functions                                            |
| Application service     | application                       | `services/<x>.service.ts`                               | functions                                            |
| Infra service interface | application                       | `interfaces/<x>.infraService.interface.ts`              | `ITerminalInfraService`                              |
| Config interface        | application                       | `interfaces/<x>.config.interface.ts`                    | `ISettingsConfig`                                    |
| Repository              | infrastructure                    | `repositories/<x>.repository.ts`                        | `SessionRepository`                                  |
| Model                   | infrastructure                    | `database/models/<x>.model.ts`                          | `StoredSessionsModel`, `NO_STORED_SESSIONS`          |
| Infra service           | infrastructure                    | `services/<backend>/<x>.infraService.ts`                | `TerminalInfraService`                               |
| Transformer             | infrastructure                    | `services/<backend>/<x>.transformer.ts`                 | functions                                            |
| Config                  | infrastructure                    | `config/<x>.config.ts`                                  | `SettingsConfig`                                     |
| Layer                   | infrastructure                    | `di/<x>.layer.ts`, `logger/<x>.layer.ts`                | `AppLayer`                                           |
| Routes                  | presentation                      | `routes.ts`                                             | `RoutesLayer`                                        |
| Controller              | presentation                      | `controllers/<x>.controller.ts`                         | functions                                            |
| Middleware              | presentation                      | `middlewares/<x>.middleware.ts`                         | `registerCommand`                                    |
| View                    | presentation                      | `views/<x>/<x>.view.ts`                                 | `SessionsView`                                       |
| Helpers                 | any                               | `utils/<x>.utils.ts`, or beside the one file they serve | functions                                            |
| Shared types            | any                               | `<declaring file>.type.ts`, beside it                   | plain names                                          |
| Error                   | the highest layer that handles it | the top of a file (see Errors)                          | `SessionsCorruptError`                               |

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
- A `.type.ts` file sits beside the file that declares it, so its interface or implementation is the file next to it.
- Files that share their first dotted part sit in a folder of that name, as in `views/sessions/` and
  `entities/session/`; files with different first parts stay flat, as in `services/`, `interfaces/` and `valueObjects/`.
- Every `Effect.fn` span is named `<owner>.<const>`. A config, controller, domain service, infra service, layer,
  middleware, repository, service or view file owns its spans, and the owner is its file name:
  `SessionService.openSession`, `RegisterCommandMiddleware.registerCommand`, and a layer's `make<Owner>` is
  `<Owner>.make`. A helper file belongs to the one owner in its folder (`claudeCodeHarness/status.utils.ts` to
  `ClaudeCodeHarnessInfraService`); a file with no owner gives the bare const name (`withHarnessInfraService`). A
  command's root span is its command ID.
- `eslint.plugin.ts` checks the span names, the `.type.ts` placement and the stem folders, and fixes span names.
- Each entity is its own aggregate root; an aggregate of several entities gets an `.aggregate.ts`.

## Tree

```text
apps/extension/src/
  domain/
    entities/
      session/
        session.entity.ts                  SessionEntity (Schema.Class: id, projectPath, name, customName, harnessId;
                                           displayName, withName, withCustomName)
        session.repository.interface.ts    ISessionRepository: sessions, modifySessions; SessionsCorruptError,
                                           SessionsSaveFailedError
      project/
        project.entity.ts                  ProjectEntity (Schema.Class: path, name, added)
        project.repository.interface.ts    IProjectRepository: addedProjectPaths, modifyAddedProjectPaths;
                                           ProjectsCorruptError, ProjectsSaveFailedError
    valueObjects/                          SessionIdValueObject, ProjectPathValueObject (branded), StatusValueObject,
                                           HarnessIdValueObject (literals), LaunchPlanValueObject (an interface)
    services/session.domainService.ts      getNewSessionName, getSessionTitle, getUnreadSessionIds
  application/
    services/
      session.service.ts                   newSession, openSession, removeSession, renameSession, listSessions,
                                           findSession, startSessionTitleSync
      project.service.ts                   listProjects, pickProject, addProject, removeProject, newProjectTerminal;
                                           NoProjectError
      scm.service.ts                       writeCommitMessageOrShowError, offerToStageAllChanges
      workspace.service.ts                 startShownProjectSync: the viewed session's project as the only
                                           project folder; startWorkspaceSaveOffer
    interfaces/                            each with the errors and types its signatures name
      harness.infraService.interface.ts    IHarnessInfraService: prepareLaunch, clearSessionStatus,
                                           placeholderTitles, sessionStatuses, iconPath; IHarnessInfraServices: a LayerMap
                                           of them by harness id
      terminal.infraService.interface.ts   openSessionTerminal, focusSessionTerminal, closeSessionTerminal,
                                           openProjectTerminal, renameSessionTerminal, isSessionTerminalOpen,
                                           openSessionIds, activatedSessionIds, viewedSessionId,
                                           sessionTerminalTitles; TerminalLaunchRequest
      prompt.infraService.interface.ts     showErrorMessage, showInformationMessage, confirm, inputText, pickProject,
                                           pickProjectFolderPaths
      workspace.infraService.interface.ts  listWorkspaceFolderProjects, showOnlyProjectFolder, removeProjectFolder,
                                           claimWorkspaceSaveOffer, saveWorkspaceAs
      git.infraService.interface.ts        getStagedDiff, setCommitMessageInput, commit, stageAll,
                                           openInSourceControl
      commitCli.infraService.interface.ts  generateCommitMessage; CommitMessageRequest
      settings.config.interface.ts         readSettings; Settings
    utils/
      error.utils.ts                       showErrorInBackground
      harness.utils.ts                     withHarnessInfraService, forEachHarnessInfraService
  infrastructure/
    vscode/vscode.api.ts                   VsCodeApi: the only runtime import of vscode
    database/models/                       StoredSessionsModel, StoredAddedProjectPathsModel
    repositories/
      session.repository.ts                SessionRepository, on globalState: reloads on window focus
      project.repository.ts                ProjectRepository, on globalState, keyed by the window's key
    services/
      claudeCodeHarness/                   ClaudeCodeHarnessInfraService: the `claude` launch plan, --settings hooks,
                                           the status env var, the status-file watcher, the transcript lookup that
                                           picks resume or a fresh start, Claude's placeholder titles, and the
                                           transformer from its status files to ours
      vscode/                              PromptInfraService, WorkspaceInfraService, GitInfraService
      vscode/terminal/                     TerminalInfraService: session tabs and project shells; terminal.utils
                                           reads a terminal's session id from its env
      commitCli/                           CommitCliInfraService: runs the configured commit command
    config/settings.config.ts              SettingsConfig
    di/
      app.layer.ts                         AppLayer: the layer graph under the commands and views
      harnessInfraServices.layer.ts        HarnessInfraServicesLayer: LayerMap.fromRecord from harness id to its
                                           infra service
    logger/traceLog.layer.ts               TraceLogLayer
    utils/vscode.utils.ts                  acquireDisposable, fromEvent, setContext, withProgress
    utils/anchorFolder.utils.ts            findWindowKey, getAnchorFolderPath: the hidden folder 0 of a window that
                                           shows one project
  presentation/
    routes.ts                              RoutesLayer: command ID to controller
    middlewares/registerCommand.middleware.ts
                                           registerCommand: root span per command, crash logging;
                                           InvalidCommandArgumentsError
    controllers/                           session, project: decode the tree-row arguments, call the service; scm:
                                           SourceControl to project path, progress, retry after Stage All
    utils/commandArguments.utils.ts        decodeCommandArgument
    views/sessions/                        SessionsView: tree view, rows, badges, spinner, the unread state
  extension.ts                             activate
```

## Domain model

- An entity is a `Schema.Class`, and its `.entity.ts` exports only that class: a rule about one entity is a method on
  it. A rule across entities lives in a `.domainService.ts` (`getNewSessionName`, `getUnreadSessionIds`), whose every
  export is an `Effect.fn`, so each rule shows up in a trace. Lint (`no-restricted-syntax`) checks both files' exports.
- Normalization lives in Schema transforms. Services and repositories share no base class.
- Decoding with Schema is the validation, so there are no DTOs: controllers decode command arguments into entities and
  branded ids with `decodeCommandArgument`.
- `SessionIdValueObject` and `ProjectPathValueObject` are branded with `Schema.brand`; `HarnessIdValueObject` and
  `StatusValueObject` are `Schema.Literals`. A session id is a UUID, so a file name or URI path that is not one is not
  ours.
- Each value object exports its schema as `<Name>ValueObjectSchema` and its type as `<Name>ValueObject`, since lint's
  `no-redeclare` rejects a value and a type of the same name. Entities and errors are classes, which are both.
- A Schema class (entity or error) takes a `{readonly brand: unique symbol}` type argument, so two classes with the same
  fields stay distinct types; Effect's `schemaClassMissingBrand` checks it.
- A brand is created only at the edge: repositories decode what is stored, controllers decode command arguments, infra
  services decode file names and CLI output, and a value the edge produces itself (a new UUID, a path VS Code hands
  over) goes through the schema's `make`, which checks it the same way.
- Lint bans casts (`@typescript-eslint/consistent-type-assertions`, `assertionStyle: "never"`); `as const` stays
  allowed.
- Maps and errors are keyed by brands: `ReadonlyMap<SessionIdValueObject, Terminal>`,
  `TerminalNotFoundError({sessionId})`.

## Errors

- An error is a `Schema.TaggedError` class whose name ends in `Error`. It sits at the top of a file, after the imports
  and types, above the file's other classes; there are no `.error.ts` files. Lint (`no-restricted-syntax`) checks the
  placement, the name and the missing `.error.ts` files, and `perfectionist/sort-modules` keeps errors above other
  classes.
- An error lives in the highest layer that handles it. One that an interface's signature names, because a layer above
  catches it, sits in that interface's file: `interfaces/terminal.infraService.interface.ts` holds
  `TerminalNotFoundError`, which `SessionService.openSession` answers by relaunching. Any other sits in the file that
  raises it: `NoProjectError` in `project.service.ts`, `TranscriptNotFoundError` in
  `claudeCodeHarness/transcript.utils.ts`.
- An error is exported only when another file catches or raises it. `SessionNotFoundError` in `session.service.ts` is
  private, and `TerminalInfraService` keeps private the reasons no session is in view, which it reports through the
  interface as one `NoViewedSessionError`.

## Dependency injection

- **Interface:** a `Context.Service` class named `I<Name>` in a `.interface.ts` file: repositories next to their entity
  in `domain/entities`, the rest in `application/interfaces`. It has no static `layer`. Its key is the package name, the
  file's path under `src` and the class name
  (`aggregor-app/application/interfaces/terminal.infraService.interface/ITerminalInfraService`), which Effect's
  `deterministicKeys` checks.
- **Implementation:** a `Layer` exported from `infrastructure`, named after its interface without the `I`, such as
  `SessionRepository` or `TerminalInfraService`. The backend shows in the folder (`services/vscode/`), not the name.
  Harnesses are the exception, `ClaudeCodeHarnessInfraService`: the harness id is what tells them apart.
- **Container:** `infrastructure/di/app.layer.ts` merges the layers into `AppLayer`; `extension.ts` puts the commands
  and views on top, with the trace log and `VsCodeApi` underneath. There is no resolver and there are no string tokens:
  a use case's type lists the interfaces it needs, so a missing layer is a compile error.
- **Several implementations at once:** `IHarnessInfraServices` (in `application/interfaces`) is a service holding a
  `LayerMap<HarnessIdValueObject, IHarnessInfraService>`; `infrastructure/di/harnessInfraServices.layer.ts` builds it
  with `LayerMap.fromRecord` over a record that `satisfies Record<HarnessIdValueObject, Layer<IHarnessInfraService>>`,
  so a harness id without an implementation fails to compile. Every harness starts with the window and never idles out,
  since the view reads its statuses all the time. Use cases run `withHarnessInfraService(session.harnessId, effect)`,
  and the view merges every harness's statuses with `forEachHarnessInfraService`. A new harness is one
  `infrastructure/services/<harness>/` folder, with its infra service and transformer, and one record entry.
- **Harness and terminal don't know each other:** the harness returns a `LaunchPlanValueObject` (command, arguments,
  environment variables) and the terminal infra service runs it.
- **Planned with their roadmap items:** a `Hosts` LayerMap keyed by host id for SSH, a worktree infra service for M3,
  and tmux as a wrapper around the launch plan.

## Repositories, models and transformers

- Every window shares globalState, so a repository offers a read-modify-write (`modifySessions`) instead of `save`: it
  re-reads before each write, so no caller can drop another window's save or overwrite unreadable data. The change
  `modifySessions` takes is an effect, so it can run domain service rules on the sessions it re-read.
- A model lists its own fields and a `version` instead of embedding the entity, and the repository builds the entity
  from it. A new entity field then fails to compile in the repository, which is where the model's `version` bump
  belongs. `globalstorage.md` lists every stored key.
- A transformer turns an outside format (Claude Code's status files) into domain types. It sits beside the infra service
  that reads the format, since only infrastructure knows it.

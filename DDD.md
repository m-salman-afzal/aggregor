# DDD plan

Status: steps 0 and 1 are done: `domain/` holds the entities, value objects and repository interfaces, and
`infrastructure/` holds VS Code, storage, logging, settings and the layer graph. Steps 2 to 4 are still planned. The
`ddd` stack moves the code; update this file in the same change as each step, so it always says where code goes.

The layering follows vs-uc-api (a layered DDD Express API: `Domain`, `Application`, `Infrastructure`, plus `http/` for
presentation), adapted to Effect, with the places where vs-uc-api's layers leaked into each other fixed.

## Layers

| Layer             | Holds                                                                       | May import                                                                                   |
| ----------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `domain/`         | Entities, repository interfaces, value objects, transformers, domain errors | `effect` only                                                                                |
| `application/`    | Services (the use cases), client interfaces, application errors             | `domain`, `@pkg/*`                                                                           |
| `infrastructure/` | VS Code, storage, outside clients, the layer graph, logging, settings       | `domain`, `application` (to implement its interfaces), `vscode`, node, `@effect/*`, `@pkg/*` |
| `presentation/`   | Command routes, controllers, the command middleware, views                  | `application`, `domain`, `@pkg/*`, and from infrastructure only `vscode.service` and utils   |
| `extension.ts`    | `activate`: builds the runtime from the layer graph                         | everything                                                                                   |

Lint enforces the import column with `@typescript-eslint/no-restricted-imports`: one block per layer in
`eslint.config.ts`, with a regex allow-list over the `@/` import paths. `domain` and `infrastructure` are enforced
today; each step adds its layer's block. `infrastructure` may also import `@/services`, which holds the code steps 2 to
4 still move. Outside `infrastructure/vscode/vscode.service.ts`, `vscode` is a type-only import, and `application` never
sees it, not even its types.

## From vs-uc-api to aggregor

| vs-uc-api                                         | aggregor                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `Domain/Entities/<X>/{XEntity, IXRepository}`     | `domain/entities/<x>/{x.entity.ts, x.repository.ts}`                    |
| `Domain/ValueObjects`                             | `domain/value-objects/`, as branded or literal schemas                  |
| `Domain/Transformers` (Drchrono data to ours)     | `domain/transformers/` (Claude Code formats to ours)                    |
| `Domain/Validations`                              | none: decoding with Schema is the validation                            |
| `Application/<Feature>/<Feature>Service`          | `application/<feature>/<feature>.service.ts`                            |
| `Application/<Feature>/Dtos`                      | none: controllers decode arguments into entities and branded ids        |
| `Application/Utils`                               | `application/utils/`                                                    |
| `Infrastructure/Database/Models`                  | `infrastructure/database/models/`: the versioned shapes kept in VS Code |
| `Infrastructure/Repository`, `MysqlRepository`    | `infrastructure/repositories/`, on VS Code's global and workspace state |
| `Infrastructure/Services/ThirdPartyClient/<X>`    | `infrastructure/clients/<x>/`                                           |
| `Infrastructure/DIContainer/{Container,Resolver}` | `infrastructure/di/`: a graph of Effect layers, no resolver             |
| `Infrastructure/{Logger,Config,Error,Utils}`      | `infrastructure/{logger,config,errors,utils}/`                          |
| `http/{Routes,Controllers,Middlewares,Sockets}`   | `presentation/{routes.ts,controllers/,middlewares/,views/}`             |
| `http/Server`                                     | `extension.ts`                                                          |

## Target tree

`←` names the code that moves there today.

```text
apps/extension/src/
  domain/
    entities/
      session/
        session.entity.ts        Session (Schema.Class: id, repoPath, name, harnessId), getNewSessionName,
                                 getUnreadSessionIds (done)
        session.repository.ts    SessionRepository interface: sessions ref, modifySessions (done)
      repo/
        repo.entity.ts           Repo (Schema.Class: path, name, added) (done)
        repo.repository.ts       RepoRepository interface: addedRepoPaths ref, modifyAddedRepoPaths (done)
    value-objects/               one <name>.value-object.ts each: SessionIdSchema, RepoPathSchema (branded),
                                 StatusSchema, HarnessIdSchema (literals) (done); LaunchPlan (step 3)
    transformers/
      claude-code.transformer.ts transcript line to title, status-file text to Status (done)
    errors/                      SessionNotFound, TitleNotFound, and the repository errors SessionsCorrupt,
                                 SessionsSaveFailed, ReposCorrupt, ReposSaveFailed (done)
  application/
    session/session.service.ts   newSession, openSession, removeSession, relaunchSession, getSessionDisplayName
                                 ← terminal.utils, store.utils add and delete
    repo/repo.service.ts         listRepos, pickRepo, addRepo, removeRepo ← repo.utils
    scm/scm.service.ts           the generate-commit-message flow ← scm.utils, minus the git API calls
    clients/                     interfaces to outside systems
      harness.client.ts          getLaunchPlan, canResume, prepareLaunch, sessionStatuses, sessionTitles
      terminal.client.ts         open, focus, close, isOpen, viewedSessionId
      prompt.client.ts           showError, confirm, quick picks, the folder dialog
      git.client.ts              stagedDiff, commit, stageAll, open or close a repo in Source Control
    utils/                       showErrorInBackground
    errors/                      RemoveCancelled, RepoPickCancelled, NothingStaged, ...
  infrastructure/
    vscode/vscode.service.ts     the only runtime import of vscode (done)
    database/models/             StoredSessions v1, StoredAddedRepoPaths v1 (done)
    repositories/
      session.repository.ts      SessionRepositoryOnGlobalState: reloads on window focus (done)
      repo.repository.ts         RepoRepositoryOnWorkspaceState (done)
    clients/
      claude-code/               HarnessClient for Claude Code: the `claude` launch, --settings hooks, the status env
                                 var, status-file and transcript watchers ← status.service, transcript.service
      vscode/                    TerminalClient ← terminal.service; PromptClient ← error.service and quick picks;
                                 GitClient ← the git-extension parts of scm.utils
      commit-cli/                runs the configured commit command ← scm.utils getCommitMessage
    di/
      app.layer.ts               AppLayer: the layer graph under the commands and views (done)
      harnesses.layer.ts         LayerMap from HarnessId to that harness's HarnessClient layer
    logger/trace-log.layer.ts    TraceLogLayer (done)
    config/settings.service.ts   SettingsService (done)
    utils/vscode.utils.ts        acquireDisposable, fromEvent, setContext, withProgress (done)
    errors/                      InvalidSettings (done); TerminalLaunchFailed, Git*, Commit*
  presentation/
    routes.ts                    command ID to controller ← CommandsLayer in extension.ts
    middlewares/register-command.ts  root span per command, crash logging ← registerCommand
    controllers/                 session, repo, scm: decode the tree-row arguments, call the service
    views/sessions/              tree view, rows, badges, spinner ← views/*
  extension.ts                   activate
```

The unread state stays with the view until the needs-input alerts (M2) need it too; only its rule moves to the entity.

## Dependency injection

- **Interface:** a `Context.Service` class in `domain/entities` (repositories) or `application/clients`. It has no
  static `layer`.
- **Implementation:** a `Layer` exported from `infrastructure`, such as `SessionRepositoryOnGlobalState`.
- **Container:** `infrastructure/di/app.layer.ts` merges the layers into `AppLayer`; `extension.ts` puts the commands
  and views on top, with the trace log and `VsCodeService` underneath. There is no resolver: a use case's type lists the
  interfaces it needs, so a missing layer is a compile error. vs-uc-api's string tokens failed at runtime.
- **Several implementations at once:** `Harnesses` is a `LayerMap.Service` over a fixed record typed
  `Record<HarnessId, Layer<HarnessClient>>`, so a `HarnessId` without an implementation fails to compile. Use cases run
  `Effect.provide(Harnesses.get(session.harnessId))`. A new harness is one transformer, one
  `infrastructure/clients/<harness>/` folder and one record entry.
- **Harness and terminal don't know each other:** the harness returns a `LaunchPlan` (shell, arguments, env) and the
  terminal client runs it.
- **Later, with their roadmap items:** a `Hosts` LayerMap keyed by host id for SSH, a worktree client for M3, and tmux
  as a wrapper around the `LaunchPlan`.

## Repositories and models

- Every window shares globalState, so a repository offers a read-modify-write (`modifySessions`) instead of `save`: it
  re-reads before each write, so no caller can drop another window's save or overwrite unreadable data.
- A model lists its own fields instead of embedding the entity, and the repository builds the entity from it. A new
  entity field then fails to compile in the repository, which is where the model's `version` bump belongs.
- Repository errors live in `domain/errors`, since the interfaces name them.

## Branded types

- `SessionId` and `RepoPath` are branded with `Schema.brand`; `HarnessId` and `Status` are `Schema.Literals`. A
  `SessionId` is a UUID, so a file name or URI path that is not one is not ours.
- Each value object exports its schema as `<Name>Schema` and its type as `<Name>`, since lint's `no-redeclare` rejects a
  value and a type of the same name. Entities are classes, which are both.
- A brand is created only at the edge: repositories decode what is stored, controllers decode command arguments, clients
  decode file names and CLI output, and a value the edge produces itself (a new UUID, a path VS Code hands over) goes
  through the schema's `make`, which checks it the same way.
- Lint bans casts (`@typescript-eslint/consistent-type-assertions`, `assertionStyle: "never"`); `as const` stays
  allowed.
- Maps and errors are keyed by brands: `ReadonlyMap<SessionId, Terminal>`, `SessionNotFound({sessionId: SessionId})`.

## Where this differs from vs-uc-api

1. Client interfaces live in `application/clients`, not next to their implementations in infrastructure, so application
   never imports infrastructure.
2. Interfaces speak only domain types, never `Memento`, `Terminal` or other vscode types. vs-uc-api's repository
   interfaces returned TypeORM models.
3. No resolver and no string tokens: typed Effect layers replace both.
4. No `Dtos/` or `Validations/` folders: Schema decoding does both jobs.
5. No `BaseService` or `BaseRepository`: nothing here needs generic create, read, update and delete.
6. Entities are Schema classes; normalization lives in Schema transforms, and rules are small functions on the entity
   instead of large services.
7. Lowercase kebab-case file names with suffixes, as the lint config and today's files already use.
8. `presentation/` lives inside `src`, because the extension ships as one bundle.

## Stack

Each branch is verified in the headless VS Code (the `verify-in-vscode` skill).

0. `refactor/domain-layer` (done): entities, value objects with brands, transformers, domain errors, lint for domain,
   the cast ban. Sessions are stored under `storedSessions`, with `repoPath` and `harnessId`.
1. `refactor/infrastructure-layer` (done): `vscode.service`, database models, repositories behind the domain interfaces,
   logger, config, `di/`, lint for infrastructure and for type-only `vscode` imports.
2. `refactor/application-layer`: services and client interfaces; the VS Code terminal, prompt and git clients; the
   commit CLI.
3. `refactor/harness-client`: Claude Code behind `HarnessClient`, plus the `Harnesses` LayerMap and `LaunchPlan`.
4. `refactor/presentation-layer`: routes, controllers, the `registerCommand` middleware, views.

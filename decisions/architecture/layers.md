# Layers

DDD.md's layers: what each holds and how they talk.

## Controllers decode VS Code arguments with a schema

- **Problem:** a tree view's title-bar action receives whichever row is focused. New Session from the title bar with a
  session row focused saved a session with no path, and every later read failed as corrupt.
- **Decision:** the title-bar New Session... asks for the project; every controller decodes its arguments with a schema,
  so a mismatch is logged and shown instead of reaching the service. The schema is the use case's request DTO, and a
  Sessions row passes that DTO's own field, `{sessionId}` or `{projectPath}`.
- **Alternatives considered:** a node id per row (`project:<path>`, `session:<id>`), which the tree needed as each row's
  one string and every controller took apart again (`sessionsTreeNode.utils.ts`); the webview sends objects, so the
  prefixes and their decoding went.

## DDD layers: domain, application, infrastructure, presentation

- **Problem:** services called VS Code and Claude Code directly, so the use cases depended on both.
- **Decision:** four layers with dependencies pointing inward; application declares the interfaces that infrastructure
  implements, and `vscode` is imported at runtime in one file, `vscode.api.ts` (in `@pkg/vscode`). DDD.md has the
  details; `packages/eslint/src/layers/` checks imports and names. A use case never depends on VS Code or on one agent.

## The backend drives the Sessions view

- **Problem:** once statuses came from `aggregor-pty`, the view still held the unread state, decided each row's status,
  merged five change sources itself, read the repositories and the terminal and agent services directly, and listed the
  statuses again (`RowStatus`, inline `done || idle || unknown` checks). Every change redrew the whole tree, and every
  window kept a copy of the sessions and projects.
- **Decision:**
  - The backend sends what changed, not the data: `SessionListChangeDto` is `ProjectListChanged`,
    `ProjectSessionsChanged` (a session placed, that is added or moved, or removed) or `SessionChanged` (any other
    write, or its tab opening or closing), and the view redraws only that: the whole tree, one project, or one row and
    its badge.
  - Each list reaches the view whole from one use case: `listProjectsWithSessions` and
    `listProjectsWithArchivedSessions` return a `ProjectSessionsDto` per project, its `ProjectListItemDto` with its
    sessions' `SessionListItemDto`s; `getProjectSessions` returns one project's (its row, worktrees and cleanup dot
    included) and `getSessionListItem` one row. A session's row has the status the user sees
    (`SessionStatusValueObject`, picked from the stored `AgentStatusValueObject` by `getSessionStatus`), its kind and
    progress only while the turn runs, its message unless the agent is gone, its agent's icon and its project's name.
    `SessionService` assembles them, and the view adds only each agent icon's webview URI, which VS Code alone can make.
  - No window keeps a copy: every read is a query, and each repository's `entityChanges` reads only the rows written
    since its last check (see the `data_version` entry). The spinner reads the working sessions each frame while the
    view is visible.

  One place decides what a row is, a status write redraws one row, and the data lives once, in the database. Text,
  symbols and colours stay the view's.

- **Alternatives considered:** a snapshot of every project and session, rebuilt and pushed on each change, which still
  redraws every row. Rows as ids the view read one at a time through the controllers (the project list, then each
  project's session ids, then each session's row), which the tree needed, since VS Code asked for a node's children
  lazily and found a node to redraw by its id: under the webview it left the view assembling every list, a use case's
  job, with a read per row. Per-row queries with the view still merging the change sources and diffing badges. The first
  build of this : the list's rows and changes as value objects (`ListedSessionValueObject`,
  `SessionListChangeValueObject`) built by a domain service, and a `sessionList.controller.ts` that worked out what kind
  of row it was given; but those have identity, so they are no value objects, and a controller only calls a service.

## Presentation talks to use cases in DTOs

- **Problem:** DDD.md said "there are no DTOs", so services took and returned entities and value objects, and the list's
  read models sat among the domain's value objects. Controllers did UI work (Source Control progress, a context key,
  re-running their own command), and presentation imported the domain, repositories and infrastructure.
- **Decision:**
  - Request and response DTOs live in `application/dtos/<x>.dto.ts` as schemas: `<UseCase>RequestDto`, one per use case,
    and response DTOs named for what they are (`SessionListItemDto`, `ProjectListItemDto`).
  - A controller decodes its input into the request DTO with `decodeVsCodeArgument` and calls one service; it imports
    only services, DTOs, presentation helpers and that decoder. Presenters import services' types; views import
    controllers and DTOs' types. Presentation imports nothing from the domain or infrastructure.
  - A value object is only a value: the list's rows and changes became DTOs.
  - Source Control progress and its context key moved into `CommitMessageService`, through a new
    `IProgressInfraService`; `scm.*` became `commitMessage.*`.
  - Every use case's file holds all of an entity's use cases, commands and queries; `sessionList.service.ts` went back
    into `session.service.ts`.

  Evans and Martin keep the domain isolated and pass simple structures across boundaries; Vernon has the application
  service assemble DTOs. A use case's contract is then one schema, which the controller validates against.

- **Alternatives considered:** keep passing domain objects across, as Fowler advises inside one process unless the
  presentation model and the domain model differ; they differ here (rows against entities). One request DTO per shape
  (`{sessionId}`) instead of one per use case.

## A command's failure is shown by its presenter

- **Problem:** services built and showed error messages, so the backend decided what the user reads.
- **Decision:** a use case returns every failure the user should hear about as a typed error, and ends quietly on a
  cancelled pick or a row removed meanwhile. Each feature has a presenter (`presentation/presenters/<x>.presenter.ts`)
  whose type is every failure its services return, so a new failure fails to compile until it has a message; `routes.ts`
  registers each command with its presenter, and `registerCommand` logs the failure and shows the message. A presenter
  may also name the setting that fixes the failure (`aggregorApp.agents` for a missing agent), and the message then has
  an **Open Settings** button. Work no command started logs its failures in the trace log. The backend says what went
  wrong; presentation decides how to say it.
- **Alternatives considered:** a controller mapping its errors (a controller only calls a service); one message per
  error tag for every command, which can't tell a session's terminal from a project's. For work no command starts (title
  sync, viewedAt, the project switch): handing failures to presentation through a stream.

## `@pkg/vscode` holds what presentation and infrastructure share

- **Problem:** `VsCodeApi` and the vscode helpers sat in infrastructure, but views and the middleware need them too.
- **Decision:** a workspace package, `packages/vscode`: `VsCodeApi` (the one runtime `vscode` import),
  `acquireScopedDisposable`, `streamVsCodeEvent`, `setWhenClauseContextKey`, `runWithProgressIndicator`,
  `openAggregorSettingsInSettingsEditor`, `showErrorNotificationWithoutWaiting`, and `decodeVsCodeArgument` (formerly
  `decodeCommandArgument`). Lint applies the extension's code rules to it. The helpers were `acquireDisposable`,
  `fromEvent`, `setContext`, `withProgress`, `openSetting` and `showErrorInBackground` before, which named the gesture
  rather than what each one does. Presentation imports nothing from infrastructure, and the shared code has one home.

## A set of values is an enum value object that exports its values

- **Problem:** the agent's states and kinds of wait were `Schema.Literals`, so code compared and returned bare strings
  (`status === "working"`), each one a copy a typo or rename could miss.
- **Decision:** a value object that is a set of values is a `Schema.Enum` with UPPER_CASE keys, and its file exports the
  values as an UPPER_CASE constant beside the schema (`AGENT_STATUSES`, `SESSION_STATUSES`, `STATUS_KINDS`,
  `ENTITY_CHANGE_KINDS`); code imports the constant. Presentation, which can't import the domain, looks states up in its
  constants instead of comparing them. Lint bans `Schema.Literals` in value objects, an enum value object without its
  exported constant, `.enums` outside value objects, and comparing with a state, kind-of-wait or kind-of-change string.
  The stored strings are unchanged. Each string is written once, in the domain, and lint keeps it that way for every
  such value object.
- **Alternatives considered:** a constants object per set in `@pkg/constants`, which the domain can't import. Reading
  the schema's `.enums` in each file that needs a value, one local copy per file (tried and dropped the same day).

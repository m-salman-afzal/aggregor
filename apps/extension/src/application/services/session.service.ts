import {withHarnessInfraService} from "@appUtils/harness.utils.ts";
import {
  getDefaultSessionName,
  getSessionStatus,
  getSessionTitleToSave,
  isSessionTurnRunning
} from "@domainServices/session.domainService.ts";
import {SessionListChangeDtoSchema, SessionListItemDtoSchema} from "@dtos/session.dto.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {IHarnessInfraService} from "@interfaces/harness.infraService.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {IUserInputPromptInfraService} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {SESSION_LABELS, SESSION_NOTICES} from "@pkg/constants/src/session.constant.ts";
import {addEntity, findEntities, findEntityById, removeEntity, updateEntity} from "@services/base.service.ts";
import {findOrAddProject, findProjectListItem, pickProject} from "@services/project.service.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {Array, DateTime, Effect, Predicate, Result, Schema, Stream, String, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {
  GetSessionListItemRequestDto,
  ListProjectSessionIdsRequestDto,
  NewSessionRequestDto,
  OpenSessionRequestDto,
  RemoveSessionRequestDto,
  RenameSessionRequestDto,
  SessionListChangeDto
} from "@dtos/session.dto.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {TerminalLaunchRequest} from "@interfaces/terminal.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

class RemoveCancelledError extends Schema.TaggedError<RemoveCancelledError, {readonly brand: unique symbol}>()(
  "RemoveCancelledError",
  {}
) {}

export class SessionNotFoundError extends Schema.TaggedError<SessionNotFoundError, {readonly brand: unique symbol}>()(
  "SessionNotFoundError",
  {sessionId: EntityIdValueObjectSchema}
) {}

// The session use cases: starting, opening, renaming and removing a session, the list the Sessions view shows, and the
// work that keeps each session's name and viewedAt current.

const {ProjectListChanged, ProjectSessionsChanged, SessionChanged} = SessionListChangeDtoSchema.cases;

export const findSession = Effect.fn("SessionService.findSession")(
  function* (sessionId: EntityIdValueObject) {
    return yield* findEntityById(ISessionRepository, sessionId);
  },
  (effect, sessionId) =>
    Effect.catchTag(effect, "EntityNotFoundError", () => Effect.fail(SessionNotFoundError.make({sessionId})))
);

const addSession = Effect.fn("SessionService.addSession")(function* (sessionProject: ProjectListItemDto) {
  const project = yield* findOrAddProject(sessionProject.path);
  const storedSessions = yield* findEntities(ISessionRepository, {});

  return yield* addEntity(ISessionRepository, {
    harnessId: "claude-code",
    name: yield* getDefaultSessionName(sessionProject.name, storedSessions),
    projectId: project.id
  });
});

const prepareTerminalLaunchRequest = Effect.fn("SessionService.prepareTerminalLaunchRequest")(function* (
  session: SessionEntity,
  tabName: string | undefined
) {
  const harnessInfraService = yield* IHarnessInfraService;
  const terminalLaunchRequest: TerminalLaunchRequest = {
    iconPath: harnessInfraService.iconPath,
    launchPlan: yield* harnessInfraService.prepareLaunchPlan(session),
    tabName
  };

  return terminalLaunchRequest;
});

// Only a session the user named gets a tab name; the others' tabs show the agent's own title.
const openSessionTerminal = Effect.fn("SessionService.openSessionTerminal")(function* (session: SessionEntity) {
  const terminalLaunchRequest = yield* withHarnessInfraService(
    session.harnessId,
    prepareTerminalLaunchRequest(session, session.customName)
  );

  yield* ITerminalInfraService.use((terminalInfraService) =>
    terminalInfraService.openSessionTerminal(session, terminalLaunchRequest)
  );
});

// A session whose terminal fails to launch is removed again, so no dead row stays behind.
const openNewSessionTerminal = Effect.fn("SessionService.openNewSessionTerminal")(
  function* (addedSession: SessionEntity) {
    yield* openSessionTerminal(addedSession);
  },
  (effect, addedSession) => Effect.tapError(effect, () => removeEntity(ISessionRepository, addedSession.id))
);

const startSession = Effect.fn("SessionService.startSession")(function* (
  chosenProjectPath: ProjectPathValueObject | undefined
) {
  const sessionProject =
    chosenProjectPath === undefined
      ? yield* pickProject(SESSION_LABELS.PICK_PROJECT)
      : yield* findProjectListItem(chosenProjectPath);

  const addedSession = yield* addSession(sessionProject);
  yield* openNewSessionTerminal(addedSession);
});

const relaunchSession = Effect.fn("SessionService.relaunchSession")(function* (sessionId: EntityIdValueObject) {
  const session = yield* findSession(sessionId);

  yield* openSessionTerminal(session);
});

const confirmRunningSessionRemoval = Effect.fn("SessionService.confirmRunningSessionRemoval")(function* (
  session: SessionEntity
) {
  const {confirm} = yield* IUserInputPromptInfraService;

  yield* Effect.filterOrFail(
    confirm(SESSION_NOTICES.CONFIRM_REMOVE_RUNNING(session.displayName), SESSION_LABELS.CONFIRM_REMOVE),
    (isConfirmed) => isConfirmed,
    () => RemoveCancelledError.make()
  );
});

// Closing the tab ends the agent; a tab that closed meanwhile has nothing left to stop.
const stopSessionAgent = Effect.fn("SessionService.stopSessionAgent")(
  function* (sessionId: EntityIdValueObject) {
    yield* ITerminalInfraService.use((terminalInfraService) => terminalInfraService.closeSessionTerminal(sessionId));
  },
  Effect.catchTag("TerminalNotFoundError", () => Effect.void)
);

// Confirm, then forget the session, then stop the agent, so a failed write never kills it for nothing.
const removeSessionAndStopAgent = Effect.fn("SessionService.removeSessionAndStopAgent")(function* (
  session: SessionEntity
) {
  const hasOpenTerminal = yield* ITerminalInfraService.use((terminalInfraService) =>
    terminalInfraService.isSessionTerminalOpen(session.id)
  );
  if (hasOpenTerminal) yield* confirmRunningSessionRemoval(session);

  yield* removeEntity(ISessionRepository, session.id);
  if (hasOpenTerminal) yield* stopSessionAgent(session.id);
});

// Starts a session in the request's project; without one, the user picks a project. A project no longer listed starts
// none.
export const newSession = Effect.fn("SessionService.newSession")(
  function* (request: NewSessionRequestDto) {
    yield* startSession(request.projectPath);
  },
  Effect.catchTags({ProjectNotListedError: () => Effect.void, ProjectPickCancelledError: () => Effect.void})
);

// Focuses the session's tab, or relaunches its agent when the tab is gone, on the same conversation once it has one.
export const openSession = Effect.fn("SessionService.openSession")(
  function* (request: OpenSessionRequestDto) {
    yield* ITerminalInfraService.use((terminalInfraService) =>
      terminalInfraService.focusSessionTerminal(request.sessionId)
    );
  },
  (effect, request) => Effect.catchTag(effect, "TerminalNotFoundError", () => relaunchSession(request.sessionId))
);

// The agent's transcript on disk is left alone. A session already removed has nothing left to do.
export const removeSession = Effect.fn("SessionService.removeSession")(
  function* (request: RemoveSessionRequestDto) {
    const session = yield* findSession(request.sessionId);
    yield* removeSessionAndStopAgent(session);
  },
  Effect.catchTags({RemoveCancelledError: () => Effect.void, SessionNotFoundError: () => Effect.void})
);

// The user's name for the session wins over the agent's title in the row and the tab. An empty name hands both back to
// the agent; the open tab keeps the agent's last title until it reopens, since VS Code cannot unname a tab.
export const renameSession = Effect.fn("SessionService.renameSession")(
  function* (request: RenameSessionRequestDto) {
    const session = yield* findSession(request.sessionId);
    const enteredName = yield* IUserInputPromptInfraService.use((userInputPromptInfraService) =>
      userInputPromptInfraService.askForText(SESSION_LABELS.RENAME, session.displayName)
    );
    const trimmedName = String.trim(enteredName);
    const customName = trimmedName === "" ? undefined : trimmedName;

    yield* updateEntity(ISessionRepository, session.id, {customName});
    yield* ITerminalInfraService.use((terminalInfraService) =>
      terminalInfraService.renameSessionTerminal(session.id, customName === undefined ? session.name : customName)
    );
  },
  Effect.catchTags({
    EntityNotFoundError: () => Effect.void,
    InputCancelledError: () => Effect.void,
    SessionNotFoundError: () => Effect.void
  })
);

// The kind of wait and the progress go only with a running turn, and the message only with a running agent.
const toSessionListItem = Effect.fn("SessionService.toSessionListItem")(function* (session: SessionEntity) {
  const terminalInfraService = yield* ITerminalInfraService;
  const path = yield* Path;
  const hasOpenTerminal = yield* terminalInfraService.isSessionTerminalOpen(session.id);
  const viewedSessionIdResult = yield* SubscriptionRef.get(terminalInfraService.viewedSessionId);
  const isInView = Result.getOrUndefined(viewedSessionIdResult) === session.id;
  const status = yield* getSessionStatus(session, {hasOpenTerminal, isInView});
  const isTurnRunning = yield* isSessionTurnRunning(status);
  const iconPath = yield* withHarnessInfraService(
    session.harnessId,
    IHarnessInfraService.useSync((harnessInfraService) => harnessInfraService.iconPath)
  );

  return SessionListItemDtoSchema.make({
    displayName: session.displayName,
    iconPath,
    name: session.name,
    projectName: path.basename(session.projectPath),
    projectPath: session.projectPath,
    sessionId: session.id,
    status,
    statusKind: status === "blocked" ? session.statusKind : undefined,
    statusMessage: status === "exited" ? undefined : session.statusMessage,
    statusProgress: isTurnRunning ? session.statusProgress : undefined
  });
});

export const getSessionListItem = Effect.fn("SessionService.getSessionListItem")(function* (
  request: GetSessionListItemRequestDto
) {
  const session = yield* findSession(request.sessionId);

  return yield* toSessionListItem(session);
});

// In the order they were started. A workspace folder without a session has no project row yet.
export const listProjectSessionIds = Effect.fn("SessionService.listProjectSessionIds")(function* (
  request: ListProjectSessionIdsRequestDto
) {
  const [storedProject] = yield* findEntities(IProjectRepository, {path: request.projectPath});
  if (storedProject === undefined) return [];
  const projectSessions = yield* findEntities(ISessionRepository, {projectId: storedProject.id});

  return Array.map(projectSessions, (projectSession) => projectSession.id);
});

// The sessions the list shows as working, for the spinner.
export const listWorkingSessionIds = Effect.fn("SessionService.listWorkingSessionIds")(function* () {
  const storedSessions = yield* findEntities(ISessionRepository, {});
  const reportedWorkingSessions = Array.filter(storedSessions, (storedSession) => storedSession.status === "working");
  const sessionListItems = yield* Effect.forEach(reportedWorkingSessions, toSessionListItem);
  const workingSessionListItems = Array.filter(
    sessionListItems,
    (sessionListItem) => sessionListItem.status === "working"
  );

  return Array.map(workingSessionListItems, (workingSessionListItem) => workingSessionListItem.sessionId);
});

// A session added or removed changes its project's sessions; any other write to it, or its tab opening or closing,
// changes the session. A project added or removed, or a workspace folder, changes the project list. Coming into or
// leaving view writes viewedAt, so it arrives as a write.
export const watchSessionListChanges = Effect.fn("SessionService.watchSessionListChanges")(function* () {
  const projectRepository = yield* IProjectRepository;
  const sessionRepository = yield* ISessionRepository;
  const {openedOrClosedSessionIds} = yield* ITerminalInfraService;
  const {workspaceFolderChanges} = yield* IWorkspaceInfraService;
  const sessionListChangeSources: readonly Stream.Stream<SessionListChangeDto>[] = [
    Stream.as(Stream.merge(projectRepository.entityChanges, workspaceFolderChanges), ProjectListChanged.make({})),
    Stream.map(sessionRepository.entityChanges, ({entity, kind}) =>
      kind === "updated"
        ? SessionChanged.make({sessionId: entity.id})
        : ProjectSessionsChanged.make({projectPath: entity.projectPath})
    ),
    Stream.map(openedOrClosedSessionIds, (sessionId) => SessionChanged.make({sessionId}))
  ];

  return Stream.mergeAll(sessionListChangeSources, {concurrency: "unbounded"});
});

// The session whose tab became active, while it is still a session.
export const watchActivatedSessionIds = Effect.fn("SessionService.watchActivatedSessionIds")(function* () {
  const {activatedSessionIds} = yield* ITerminalInfraService;

  return Stream.filterEffect(activatedSessionIds, (sessionId) =>
    Effect.map(Effect.result(findSession(sessionId)), Result.isSuccess)
  );
});

const findSessionTitleToSave = Effect.fn("SessionService.findSessionTitleToSave")(function* (session: SessionEntity) {
  const {placeholderTitles} = yield* withHarnessInfraService(
    session.harnessId,
    IHarnessInfraService.useSync((harnessInfraService) => harnessInfraService)
  );

  return yield* getSessionTitleToSave(session, placeholderTitles);
});

// Nothing shows the failure: no command started this, so it is logged.
const saveSessionTitle = Effect.fn("SessionService.saveSessionTitle")(
  function* (session: SessionEntity, sessionTitle: string) {
    yield* updateEntity(ISessionRepository, session.id, {name: sessionTitle});
  },
  Effect.catchTag("EntityNotFoundError", () => Effect.void),
  Effect.catch((writeError) => Effect.logWarning("Could not save the session's title", writeError))
);

// For the window's whole life, each session's name follows its agent's latest title. The check runs on every write to a
// session, so it is untraced; only a save shows in the trace.
export const startSessionTitleSync = Effect.fn("SessionService.startSessionTitleSync")(function* () {
  const {entityChanges} = yield* ISessionRepository;
  const writtenSessions = Stream.map(
    Stream.filter(entityChanges, ({kind}) => kind !== "removed"),
    ({entity}) => entity
  );

  yield* Effect.forkScoped(
    Stream.runForEach(writtenSessions, (writtenSession) =>
      Effect.flatMap(
        Effect.withTracerEnabled(Effect.result(findSessionTitleToSave(writtenSession)), false),
        (titleResult) =>
          Result.match(titleResult, {
            onFailure: () => Effect.void,
            onSuccess: (sessionTitle) => saveSessionTitle(writtenSession, sessionTitle)
          })
      )
    )
  );
});

// Nothing shows the failure: no command started this, so it is logged. A removed session has nothing to record.
const recordViewedAt = Effect.fn("SessionService.recordViewedAt")(
  function* (sessionId: EntityIdValueObject) {
    const viewedAt = yield* DateTime.now;
    yield* updateEntity(ISessionRepository, sessionId, {viewedAt});
  },
  Effect.catchTag("EntityNotFoundError", () => Effect.void),
  Effect.catch((writeError) => Effect.logWarning("Could not record when the session was in view", writeError))
);

// The session that comes into view and the one that leaves it get viewedAt, so a turn that ended before then counts as
// seen, in every window and after an extension restart.
export const startViewedAtSync = Effect.fn("SessionService.startViewedAtSync")(function* () {
  const {viewedSessionId} = yield* ITerminalInfraService;
  const enteringAndLeavingSessionIds = Stream.mapAccum(
    SubscriptionRef.changes(viewedSessionId),
    (): EntityIdValueObject | undefined => undefined,
    (leavingSessionId, viewedSessionIdResult) => {
      const enteringSessionId = Result.getOrUndefined(viewedSessionIdResult);

      return [
        enteringSessionId,
        Array.filter([leavingSessionId, enteringSessionId], Predicate.isNotUndefined)
      ] as const;
    }
  );

  yield* Effect.forkScoped(Stream.runForEach(enteringAndLeavingSessionIds, recordViewedAt));
});

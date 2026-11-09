import {
  getDefaultSessionName,
  getSessionStatus,
  getSessionTitleToSave,
  isSessionTurnRunning,
  prepareLaunchPlan
} from "@domainServices/session.domainService.ts";
import {HarnessListItemDtoSchema} from "@dtos/harness.dto.ts";
import {SessionListChangeDtoSchema, SessionListItemDtoSchema} from "@dtos/session.dto.ts";
import {HarnessNotFoundError, IHarnessRepository} from "@entities/harness/harness.repository.interface.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {ISettingsConfig} from "@interfaces/settings.config.interface.ts";
import {IShellCommandInfraService} from "@interfaces/shellCommand.infraService.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {IUserInputPromptInfraService} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {HARNESS_LABELS} from "@pkg/constants/src/harness.constant.ts";
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
import type {HarnessEntity} from "@entities/harness/harness.entity.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {TerminalLaunchRequest} from "@interfaces/terminal.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {HarnessIdValueObject} from "@valueObjects/harnessId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

// None of the harnesses' commands is on PATH.
export class NoHarnessInstalledError extends Schema.TaggedError<
  NoHarnessInstalledError,
  {readonly brand: unique symbol}
>()("NoHarnessInstalledError", {searchedCommands: Schema.Array(Schema.String)}) {}

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

const addSession = Effect.fn("SessionService.addSession")(function* (
  sessionProject: ProjectListItemDto,
  sessionHarness: HarnessEntity
) {
  const project = yield* findOrAddProject(sessionProject.path);
  const storedSessions = yield* findEntities(ISessionRepository, {});

  return yield* addEntity(ISessionRepository, {
    harnessId: sessionHarness.id,
    name: yield* getDefaultSessionName(sessionProject.name, storedSessions),
    projectId: project.id
  });
});

// The tab shows the session's name, as its row does.
const prepareTerminalLaunchRequest = Effect.fn("SessionService.prepareTerminalLaunchRequest")(function* (
  session: SessionEntity
) {
  const sessionHarness = yield* IHarnessRepository.use((harnessRepository) =>
    harnessRepository.findById(session.harnessId)
  );
  const launchPlan = yield* prepareLaunchPlan(sessionHarness, session);
  const terminalLaunchRequest: TerminalLaunchRequest = {
    icon: sessionHarness.icon,
    launchPlan,
    tabName: session.displayName
  };

  return terminalLaunchRequest;
});

const openSessionTerminal = Effect.fn("SessionService.openSessionTerminal")(function* (session: SessionEntity) {
  const terminalLaunchRequest = yield* prepareTerminalLaunchRequest(session);

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

// The harnesses whose command is on PATH; the others can't start.
const listInstalledHarnesses = Effect.fn("SessionService.listInstalledHarnesses")(function* () {
  const harnesses = yield* IHarnessRepository.use((harnessRepository) => harnessRepository.findAll);
  const harnessCommands = Array.map(harnesses, (harness) => harness.command);
  const installedCommands = yield* IShellCommandInfraService.use((shellCommandInfraService) =>
    shellCommandInfraService.listInstalledCommands(harnessCommands)
  );
  const installedHarnesses = Array.filter(harnesses, (harness) => installedCommands.has(harness.command));
  if (installedHarnesses.length === 0) return yield* NoHarnessInstalledError.make({searchedCommands: harnessCommands});

  return installedHarnesses;
});

// The default first, as the picker shows them.
const toHarnessListItems = Effect.fn("SessionService.toHarnessListItems")(function* (
  installedHarnesses: readonly HarnessEntity[],
  defaultHarnessId: HarnessIdValueObject
) {
  const harnessListItems = Array.map(installedHarnesses, (installedHarness) =>
    HarnessListItemDtoSchema.make({
      command: installedHarness.command,
      harnessId: installedHarness.id,
      icon: installedHarness.icon,
      isDefault: installedHarness.id === defaultHarnessId,
      name: installedHarness.name
    })
  );

  return [
    ...Array.filter(harnessListItems, (harnessListItem) => harnessListItem.isDefault),
    ...Array.filter(harnessListItems, (harnessListItem) => !harnessListItem.isDefault)
  ];
});

const findInstalledHarness = Effect.fn("SessionService.findInstalledHarness")(function* (
  installedHarnesses: readonly HarnessEntity[],
  harnessId: HarnessIdValueObject
) {
  return yield* Effect.fromResult(
    Result.fromOption(
      Array.findFirst(installedHarnesses, (installedHarness) => installedHarness.id === harnessId),
      () => HarnessNotFoundError.make({harnessId})
    )
  );
});

// Choosing another default saves it to the user's settings and shows the list again, reordered.
const pickHarness = Effect.fn("SessionService.pickHarness")(function* (
  installedHarnesses: readonly HarnessEntity[],
  savedDefaultHarnessId: HarnessIdValueObject
) {
  let defaultHarnessId = savedDefaultHarnessId;
  for (;;) {
    const harnessListItems = yield* toHarnessListItems(installedHarnesses, defaultHarnessId);
    const harnessPick = yield* IUserInputPromptInfraService.use((userInputPromptInfraService) =>
      userInputPromptInfraService.pickHarness(harnessListItems, HARNESS_LABELS.PICK)
    );
    if (harnessPick._tag === "HarnessPicked")
      return yield* findInstalledHarness(installedHarnesses, harnessPick.harnessId);
    yield* ISettingsConfig.use((settingsConfig) => settingsConfig.saveDefaultHarnessId(harnessPick.harnessId));
    defaultHarnessId = harnessPick.harnessId;
  }
});

// The only installed harness starts straight away, and so does the default when the user asked to skip the picker. A
// default that isn't installed leaves the choice to the picker.
const chooseHarness = Effect.fn("SessionService.chooseHarness")(function* () {
  const {defaultHarnessId, skipHarnessPicker} = yield* ISettingsConfig.use(
    (settingsConfig) => settingsConfig.readSessionSettings
  );
  const installedHarnesses = yield* listInstalledHarnesses();
  const [onlyInstalledHarness] = installedHarnesses;
  if (installedHarnesses.length === 1 && onlyInstalledHarness !== undefined) return onlyInstalledHarness;
  const defaultHarnessResult = yield* Effect.result(findInstalledHarness(installedHarnesses, defaultHarnessId));
  if (skipHarnessPicker && Result.isSuccess(defaultHarnessResult)) return defaultHarnessResult.success;

  return yield* pickHarness(installedHarnesses, defaultHarnessId);
});

// The project first, then the agent.
const startSession = Effect.fn("SessionService.startSession")(function* (
  chosenProjectPath: ProjectPathValueObject | undefined
) {
  const sessionProject =
    chosenProjectPath === undefined
      ? yield* pickProject(SESSION_LABELS.PICK_PROJECT)
      : yield* findProjectListItem(chosenProjectPath);
  const sessionHarness = yield* chooseHarness();

  const addedSession = yield* addSession(sessionProject, sessionHarness);
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
  Effect.catchTags({
    HarnessPickCancelledError: () => Effect.void,
    ProjectNotListedError: () => Effect.void,
    ProjectPickCancelledError: () => Effect.void
  })
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

// The user's name for the session wins over the agent's title in the row and the tab, which the tab name sync follows. An
// empty name hands both back to the agent.
export const renameSession = Effect.fn("SessionService.renameSession")(
  function* (request: RenameSessionRequestDto) {
    const session = yield* findSession(request.sessionId);
    const enteredName = yield* IUserInputPromptInfraService.use((userInputPromptInfraService) =>
      userInputPromptInfraService.askForText(SESSION_LABELS.RENAME, session.displayName)
    );
    const trimmedName = String.trim(enteredName);
    const customName = trimmedName === "" ? undefined : trimmedName;

    yield* updateEntity(ISessionRepository, session.id, {customName});
  },
  Effect.catchTags({
    EntityNotFoundError: () => Effect.void,
    InputCancelledError: () => Effect.void,
    SessionNotFoundError: () => Effect.void
  })
);

// The kind of wait and the progress go only with a running turn, and the message only with a running agent. A session
// whose harness is gone from the settings has no icon.
const toSessionListItem = Effect.fn("SessionService.toSessionListItem")(function* (session: SessionEntity) {
  const terminalInfraService = yield* ITerminalInfraService;
  const path = yield* Path;
  const hasOpenTerminal = yield* terminalInfraService.isSessionTerminalOpen(session.id);
  const viewedSessionIdResult = yield* SubscriptionRef.get(terminalInfraService.viewedSessionId);
  const isInView = Result.getOrUndefined(viewedSessionIdResult) === session.id;
  const status = yield* getSessionStatus(session, {hasOpenTerminal, isInView});
  const isTurnRunning = yield* isSessionTurnRunning(status);
  const harnessResult = yield* Effect.result(
    IHarnessRepository.use((harnessRepository) => harnessRepository.findById(session.harnessId))
  );

  return SessionListItemDtoSchema.make({
    displayName: session.displayName,
    icon: Result.getOrUndefined(Result.map(harnessResult, (sessionHarness) => sessionHarness.icon)),
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

// The session whose tab is in front of the user, each time another one comes to the front. No session in front (another
// tab, or the window unfocused) emits nothing.
export const watchViewedSessionIds = Effect.fn("SessionService.watchViewedSessionIds")(function* () {
  const {viewedSessionId} = yield* ITerminalInfraService;

  return Stream.filterMap(SubscriptionRef.changes(viewedSessionId), (viewedSessionIdResult) => viewedSessionIdResult);
});

// The session whose tab is in front of the user, or NoViewedSessionError when none is.
export const findViewedSessionId = Effect.fn("SessionService.findViewedSessionId")(function* () {
  const {viewedSessionId} = yield* ITerminalInfraService;
  const viewedSessionIdResult = yield* SubscriptionRef.get(viewedSessionId);

  return yield* Effect.fromResult(viewedSessionIdResult);
});

const findSessionTitleToSave = Effect.fn("SessionService.findSessionTitleToSave")(function* (session: SessionEntity) {
  const path = yield* Path;
  const sessionHarness = yield* IHarnessRepository.use((harnessRepository) =>
    harnessRepository.findById(session.harnessId)
  );

  return yield* getSessionTitleToSave(session, sessionHarness, path.basename(session.projectPath));
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

// The written session, or the one whose tab came to the front. Nothing shows the failure: no command started this, so it
// is logged; a removed session has no tab to name.
const nameSessionTab = Effect.fn("SessionService.nameSessionTab")(
  function* (writtenOrActivatedSession: EntityIdValueObject | SessionEntity) {
    const session = Predicate.isString(writtenOrActivatedSession)
      ? yield* findSession(writtenOrActivatedSession)
      : writtenOrActivatedSession;

    yield* ITerminalInfraService.use((terminalInfraService) =>
      terminalInfraService.nameActiveSessionTab(session.id, session.displayName)
    );
  },
  Effect.catchTag("SessionNotFoundError", () => Effect.void),
  Effect.catch((readError) => Effect.logWarning("Could not name the session's tab", readError))
);

// For the window's whole life, each session's tab shows the name its row shows. VS Code renames only the active
// terminal, so the tab follows a new name at once when it is in front, else when it next comes to the front. The check
// runs on every write to a session, so it is untraced; only a rename shows in the trace.
export const startSessionTabNameSync = Effect.fn("SessionService.startSessionTabNameSync")(function* () {
  const {entityChanges} = yield* ISessionRepository;
  const {activatedSessionIds} = yield* ITerminalInfraService;
  const writtenSessions = Stream.map(
    Stream.filter(entityChanges, ({kind}) => kind !== "removed"),
    ({entity}) => entity
  );
  const writtenOrActivatedSessions = Stream.merge(writtenSessions, activatedSessionIds);

  yield* Effect.forkScoped(
    Stream.runForEach(writtenOrActivatedSessions, (writtenOrActivatedSession) =>
      Effect.withTracerEnabled(nameSessionTab(writtenOrActivatedSession), false)
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

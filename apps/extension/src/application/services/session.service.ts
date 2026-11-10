import {
  getDefaultSessionName,
  getSessionStatus,
  getSessionTitleToSave,
  isSessionTurnRunning,
  isSessionWaitingOnUser,
  prepareLaunchPlan
} from "@domainServices/session.domainService.ts";
import {
  canMoveDownInOrder,
  canMoveUpInOrder,
  findEntityIdsToPlaceAtEnd
} from "@domainServices/sortOrder.domainService.ts";
import {AgentListItemDtoSchema} from "@dtos/agent.dto.ts";
import {SessionListChangeDtoSchema, SessionListItemDtoSchema} from "@dtos/session.dto.ts";
import {AgentNotFoundError, IAgentRepository} from "@entities/agent/agent.repository.interface.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {ISettingsConfig} from "@interfaces/settings.config.interface.ts";
import {IShellCommandInfraService} from "@interfaces/shellCommand.infraService.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {ITmuxInfraService} from "@interfaces/tmux.infraService.interface.ts";
import {IUserInputPromptInfraService} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {AGENT_LABELS} from "@pkg/constants/src/agent.constant.ts";
import {SESSION_LABELS, SESSION_NOTICES} from "@pkg/constants/src/session.constant.ts";
import {
  addEntity,
  findEntities,
  findEntityById,
  placeEntitiesAtEnd,
  removeEntity,
  updateEntity
} from "@services/base.service.ts";
import {findOrAddProject, findProjectListItem, pickProject} from "@services/project.service.ts";
import {AGENT_STATUSES} from "@valueObjects/agentStatus.valueObject.ts";
import {ENTITY_CHANGE_KINDS} from "@valueObjects/entityChangeKind.valueObject.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {SESSION_STATUSES} from "@valueObjects/sessionStatus.valueObject.ts";
import {Array, DateTime, Effect, Predicate, Result, Schema, Stream, String, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {
  GetSessionListItemRequestDto,
  ListProjectSessionIdsRequestDto,
  MoveSessionDownRequestDto,
  MoveSessionToPlaceOfRequestDto,
  MoveSessionUpRequestDto,
  NewSessionRequestDto,
  OpenSessionRequestDto,
  RemoveSessionRequestDto,
  RenameSessionRequestDto,
  SessionListChangeDto
} from "@dtos/session.dto.ts";
import type {AgentEntity} from "@entities/agent/agent.entity.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {SessionTabRequest} from "@interfaces/terminal.infraService.interface.ts";
import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

// None of the agents' commands is on PATH.
export class NoAgentInstalledError extends Schema.TaggedError<NoAgentInstalledError, {readonly brand: unique symbol}>()(
  "NoAgentInstalledError",
  {searchedCommands: Schema.Array(Schema.String)}
) {}

class RemoveCancelledError extends Schema.TaggedError<RemoveCancelledError, {readonly brand: unique symbol}>()(
  "RemoveCancelledError",
  {}
) {}

export class SessionNotFoundError extends Schema.TaggedError<SessionNotFoundError, {readonly brand: unique symbol}>()(
  "SessionNotFoundError",
  {sessionId: EntityIdValueObjectSchema}
) {}

// The session use cases: starting, opening, renaming, moving and removing a session, the list the Sessions view shows,
// and the work that keeps each session's name and viewedAt current.

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
  sessionAgent: AgentEntity
) {
  const project = yield* findOrAddProject(sessionProject.path);
  const storedSessions = yield* findEntities(ISessionRepository, {});

  return yield* addEntity(ISessionRepository, {
    agentId: sessionAgent.id,
    name: yield* getDefaultSessionName(sessionProject.name, storedSessions),
    projectId: project.id
  });
});

const findSessionAgent = Effect.fn("SessionService.findSessionAgent")(function* (session: SessionEntity) {
  return yield* IAgentRepository.use((agentRepository) => agentRepository.findById(session.agentId));
});

// The tab attaches to the agent's tmux session, or starts the agent in one when it isn't running, and shows the
// session's name, as its row does.
const openSessionTab = Effect.fn("SessionService.openSessionTab")(function* (session: SessionEntity) {
  const {prepareSessionTabCommand, waitForSessionAgentStart} = yield* ITmuxInfraService;
  const sessionAgent = yield* findSessionAgent(session);
  const launchPlan = yield* prepareLaunchPlan(sessionAgent, session);
  const tabCommand = yield* prepareSessionTabCommand({
    launchPlan,
    projectPath: session.projectPath,
    sessionId: session.id
  });
  const sessionTabRequest: SessionTabRequest = {icon: sessionAgent.icon, tabCommand, tabName: session.displayName};

  yield* ITerminalInfraService.use((terminalInfraService) =>
    terminalInfraService.openSessionTerminal(session, sessionTabRequest)
  );
  yield* waitForSessionAgentStart(session.id);
});

// A new session whose tab fails to open is removed again, with any agent it started, so no dead row stays behind.
const launchNewSession = Effect.fn("SessionService.launchNewSession")(
  function* (addedSession: SessionEntity) {
    yield* openSessionTab(addedSession);
  },
  (effect, addedSession) =>
    Effect.tapError(effect, () =>
      Effect.andThen(
        removeEntity(ISessionRepository, addedSession.id),
        ITmuxInfraService.use((tmuxInfraService) => tmuxInfraService.stopSessionAgent(addedSession.id))
      )
    )
);

// The agents whose command is on PATH; the others can't start.
const listInstalledAgents = Effect.fn("SessionService.listInstalledAgents")(function* () {
  const agents = yield* IAgentRepository.use((agentRepository) => agentRepository.findAll);
  const agentCommands = Array.map(agents, (agent) => agent.command);
  const installedCommands = yield* IShellCommandInfraService.use((shellCommandInfraService) =>
    shellCommandInfraService.listInstalledCommands(agentCommands)
  );
  const installedAgents = Array.filter(agents, (agent) => installedCommands.has(agent.command));
  if (installedAgents.length === 0) return yield* NoAgentInstalledError.make({searchedCommands: agentCommands});

  return installedAgents;
});

// The default first, as the picker shows them.
const toAgentListItems = Effect.fn("SessionService.toAgentListItems")(function* (
  installedAgents: readonly AgentEntity[],
  defaultAgentId: AgentIdValueObject
) {
  const agentListItems = Array.map(installedAgents, (installedAgent) =>
    AgentListItemDtoSchema.make({
      agentId: installedAgent.id,
      command: installedAgent.command,
      icon: installedAgent.icon,
      isDefault: installedAgent.id === defaultAgentId,
      name: installedAgent.name
    })
  );

  return [
    ...Array.filter(agentListItems, (agentListItem) => agentListItem.isDefault),
    ...Array.filter(agentListItems, (agentListItem) => !agentListItem.isDefault)
  ];
});

const findInstalledAgent = Effect.fn("SessionService.findInstalledAgent")(function* (
  installedAgents: readonly AgentEntity[],
  agentId: AgentIdValueObject
) {
  return yield* Effect.fromResult(
    Result.fromOption(
      Array.findFirst(installedAgents, (installedAgent) => installedAgent.id === agentId),
      () => AgentNotFoundError.make({agentId})
    )
  );
});

// Choosing another default saves it to the user's settings and shows the list again, reordered.
const pickAgent = Effect.fn("SessionService.pickAgent")(function* (
  installedAgents: readonly AgentEntity[],
  savedDefaultAgentId: AgentIdValueObject
) {
  let defaultAgentId = savedDefaultAgentId;
  for (;;) {
    const agentListItems = yield* toAgentListItems(installedAgents, defaultAgentId);
    const agentPick = yield* IUserInputPromptInfraService.use((userInputPromptInfraService) =>
      userInputPromptInfraService.pickAgent(agentListItems, AGENT_LABELS.PICK)
    );
    if (agentPick._tag === "AgentPicked") return yield* findInstalledAgent(installedAgents, agentPick.agentId);
    yield* ISettingsConfig.use((settingsConfig) => settingsConfig.saveDefaultAgentId(agentPick.agentId));
    defaultAgentId = agentPick.agentId;
  }
});

// The only installed agent starts straight away, and so does the default when the user asked to skip the picker. A
// default that isn't installed leaves the choice to the picker.
const chooseAgent = Effect.fn("SessionService.chooseAgent")(function* () {
  const {defaultAgentId, skipAgentPicker} = yield* ISettingsConfig.use(
    (settingsConfig) => settingsConfig.readSessionSettings
  );
  const installedAgents = yield* listInstalledAgents();
  const [onlyInstalledAgent] = installedAgents;
  if (installedAgents.length === 1 && onlyInstalledAgent !== undefined) return onlyInstalledAgent;
  const defaultAgentResult = yield* Effect.result(findInstalledAgent(installedAgents, defaultAgentId));
  if (skipAgentPicker && Result.isSuccess(defaultAgentResult)) return defaultAgentResult.success;

  return yield* pickAgent(installedAgents, defaultAgentId);
});

// The project first, then the agent.
const startSession = Effect.fn("SessionService.startSession")(function* (
  chosenProjectPath: ProjectPathValueObject | undefined
) {
  const sessionProject =
    chosenProjectPath === undefined
      ? yield* pickProject(SESSION_LABELS.PICK_PROJECT)
      : yield* findProjectListItem(chosenProjectPath);
  const sessionAgent = yield* chooseAgent();

  const addedSession = yield* addSession(sessionProject, sessionAgent);
  yield* launchNewSession(addedSession);
});

// A session without a tab in this window gets one, attached to its agent when tmux still runs it, else starting it
// again.
const reopenSession = Effect.fn("SessionService.reopenSession")(function* (sessionId: EntityIdValueObject) {
  const session = yield* findSession(sessionId);

  yield* openSessionTab(session);
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

// A tab that closed meanwhile has nothing left to close.
const closeSessionTab = Effect.fn("SessionService.closeSessionTab")(
  function* (sessionId: EntityIdValueObject) {
    yield* ITerminalInfraService.use((terminalInfraService) => terminalInfraService.closeSessionTerminal(sessionId));
  },
  Effect.catchTag("TerminalNotFoundError", () => Effect.void)
);

// Confirm while the agent runs, then forget the session, then end its tmux session and close its tab, so a failed write
// never kills the agent for nothing.
const removeSessionAndStopAgent = Effect.fn("SessionService.removeSessionAndStopAgent")(function* (
  session: SessionEntity
) {
  const runningSessionIds = yield* ITmuxInfraService.use(
    (tmuxInfraService) => tmuxInfraService.refreshRunningSessionIds
  );
  if (runningSessionIds.has(session.id)) yield* confirmRunningSessionRemoval(session);

  yield* removeEntity(ISessionRepository, session.id);
  yield* ITmuxInfraService.use((tmuxInfraService) => tmuxInfraService.stopSessionAgent(session.id));
  yield* closeSessionTab(session.id);
});

// Starts a session in the request's project; without one, the user picks a project. A project no longer listed starts
// none.
export const newSession = Effect.fn("SessionService.newSession")(
  function* (request: NewSessionRequestDto) {
    yield* startSession(request.projectPath);
  },
  Effect.catchTags({
    AgentPickCancelledError: () => Effect.void,
    ProjectNotListedError: () => Effect.void,
    ProjectPickCancelledError: () => Effect.void
  })
);

// Focuses the session's tab, or opens one when the tab is gone, attached to its agent or to its agent started again.
export const openSession = Effect.fn("SessionService.openSession")(
  function* (request: OpenSessionRequestDto) {
    yield* ITerminalInfraService.use((terminalInfraService) =>
      terminalInfraService.focusSessionTerminal(request.sessionId)
    );
  },
  (effect, request) => Effect.catchTag(effect, "TerminalNotFoundError", () => reopenSession(request.sessionId))
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

// The session's place among its project's sessions, in their order.
const findSessionPlaceInProject = Effect.fn("SessionService.findSessionPlaceInProject")(function* (
  sessionId: EntityIdValueObject
) {
  const session = yield* findSession(sessionId);
  const projectSessions = yield* findEntities(ISessionRepository, {projectId: session.projectId});
  const projectSessionIds = Array.map(projectSessions, (projectSession) => projectSession.id);

  return {projectSessionIds, sessionIndex: projectSessionIds.indexOf(sessionId)};
});

// The first session stays where it is. A session removed meanwhile is left alone.
export const moveSessionUp = Effect.fn("SessionService.moveSessionUp")(
  function* (request: MoveSessionUpRequestDto) {
    const {projectSessionIds, sessionIndex} = yield* findSessionPlaceInProject(request.sessionId);
    const sessionIdsToPlaceAtEnd = yield* findEntityIdsToPlaceAtEnd(projectSessionIds, sessionIndex, sessionIndex - 1);
    yield* placeEntitiesAtEnd(ISessionRepository, sessionIdsToPlaceAtEnd);
  },
  Effect.catchTag("SessionNotFoundError", () => Effect.void)
);

// The last session stays where it is. A session removed meanwhile is left alone.
export const moveSessionDown = Effect.fn("SessionService.moveSessionDown")(
  function* (request: MoveSessionDownRequestDto) {
    const {projectSessionIds, sessionIndex} = yield* findSessionPlaceInProject(request.sessionId);
    const sessionIdsToPlaceAtEnd = yield* findEntityIdsToPlaceAtEnd(projectSessionIds, sessionIndex, sessionIndex + 1);
    yield* placeEntitiesAtEnd(ISessionRepository, sessionIdsToPlaceAtEnd);
  },
  Effect.catchTag("SessionNotFoundError", () => Effect.void)
);

// A session moves only among its project's sessions, so the place of another project's session moves nothing.
export const moveSessionToPlaceOf = Effect.fn("SessionService.moveSessionToPlaceOf")(
  function* (request: MoveSessionToPlaceOfRequestDto) {
    const {projectSessionIds, sessionIndex} = yield* findSessionPlaceInProject(request.sessionId);
    const placeIndex = projectSessionIds.indexOf(request.placeOfSessionId);
    const sessionIdsToPlaceAtEnd = yield* findEntityIdsToPlaceAtEnd(projectSessionIds, sessionIndex, placeIndex);
    yield* placeEntitiesAtEnd(ISessionRepository, sessionIdsToPlaceAtEnd);
  },
  Effect.catchTag("SessionNotFoundError", () => Effect.void)
);

// Which ways the session can move among its project's sessions, read from sessions in their order that include them.
const findSessionMoves = Effect.fn("SessionService.findSessionMoves")(function* (
  session: SessionEntity,
  orderedSessions: readonly SessionEntity[]
) {
  const projectSessions = Array.filter(
    orderedSessions,
    (orderedSession) => orderedSession.projectId === session.projectId
  );
  const projectSessionIds = Array.map(projectSessions, (projectSession) => projectSession.id);

  return {
    canMoveDown: yield* canMoveDownInOrder(projectSessionIds, session.id),
    canMoveUp: yield* canMoveUpInOrder(projectSessionIds, session.id)
  };
});

// The kind of wait and the progress go only with a running turn, and the message only with a running agent. A session
// whose agent is gone from the settings has no icon.
const toSessionListItem = Effect.fn("SessionService.toSessionListItem")(function* (
  session: SessionEntity,
  orderedSessions: readonly SessionEntity[]
) {
  const {viewedSessionId} = yield* ITerminalInfraService;
  const tmuxInfraService = yield* ITmuxInfraService;
  const path = yield* Path;
  const runningSessionIds = yield* SubscriptionRef.get(tmuxInfraService.runningSessionIds);
  const viewedSessionIdResult = yield* SubscriptionRef.get(viewedSessionId);
  const isInView = Result.getOrUndefined(viewedSessionIdResult) === session.id;
  const status = yield* getSessionStatus(session, {isAgentRunning: runningSessionIds.has(session.id), isInView});
  const isTurnRunning = yield* isSessionTurnRunning(status);
  const agentResult = yield* Effect.result(
    IAgentRepository.use((agentRepository) => agentRepository.findById(session.agentId))
  );

  return SessionListItemDtoSchema.make({
    ...(yield* findSessionMoves(session, orderedSessions)),
    displayName: session.displayName,
    icon: Result.getOrUndefined(Result.map(agentResult, (sessionAgent) => sessionAgent.icon)),
    name: session.name,
    projectName: path.basename(session.projectPath),
    projectPath: session.projectPath,
    sessionId: session.id,
    status,
    statusKind: status === SESSION_STATUSES.BLOCKED ? session.statusKind : undefined,
    statusMessage: status === SESSION_STATUSES.EXITED ? undefined : session.statusMessage,
    statusProgress: isTurnRunning ? session.statusProgress : undefined
  });
});

export const getSessionListItem = Effect.fn("SessionService.getSessionListItem")(function* (
  request: GetSessionListItemRequestDto
) {
  const session = yield* findSession(request.sessionId);
  const projectSessions = yield* findEntities(ISessionRepository, {projectId: session.projectId});

  return yield* toSessionListItem(session, projectSessions);
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
  const reportedWorkingSessions = Array.filter(
    storedSessions,
    (storedSession) => storedSession.status === AGENT_STATUSES.WORKING
  );
  const sessionListItems = yield* Effect.forEach(reportedWorkingSessions, (reportedWorkingSession) =>
    toSessionListItem(reportedWorkingSession, storedSessions)
  );
  const workingSessionListItems = Array.filter(
    sessionListItems,
    (sessionListItem) => sessionListItem.status === SESSION_STATUSES.WORKING
  );

  return Array.map(workingSessionListItems, (workingSessionListItem) => workingSessionListItem.sessionId);
});

// The sessions waiting on the user, for the view's badge: asking something, failed, or with a finished turn unseen.
export const listSessionsWaitingOnUser = Effect.fn("SessionService.listSessionsWaitingOnUser")(function* () {
  const storedSessions = yield* findEntities(ISessionRepository, {});
  const sessionListItems = yield* Effect.forEach(storedSessions, (storedSession) =>
    toSessionListItem(storedSession, storedSessions)
  );

  return yield* Effect.filter(sessionListItems, (sessionListItem) => isSessionWaitingOnUser(sessionListItem.status));
});

// A session placed (added, or moved) or removed changes its project's sessions; any other write to it, or its agent
// starting or stopping, changes the session. A project added or removed, or a workspace folder, changes the project list. Coming into or
// leaving view writes viewedAt, so it arrives as a write.
export const watchSessionListChanges = Effect.fn("SessionService.watchSessionListChanges")(function* () {
  const projectRepository = yield* IProjectRepository;
  const sessionRepository = yield* ISessionRepository;
  const {startedOrStoppedSessionIds} = yield* ITmuxInfraService;
  const {workspaceFolderChanges} = yield* IWorkspaceInfraService;
  const sessionListChangeSources: readonly Stream.Stream<SessionListChangeDto>[] = [
    Stream.as(Stream.merge(projectRepository.entityChanges, workspaceFolderChanges), ProjectListChanged.make({})),
    Stream.map(sessionRepository.entityChanges, ({entity, kind}) =>
      kind === ENTITY_CHANGE_KINDS.UPDATED
        ? SessionChanged.make({sessionId: entity.id})
        : ProjectSessionsChanged.make({projectPath: entity.projectPath})
    ),
    Stream.map(startedOrStoppedSessionIds, (sessionId) => SessionChanged.make({sessionId}))
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
  const sessionAgent = yield* IAgentRepository.use((agentRepository) => agentRepository.findById(session.agentId));

  return yield* getSessionTitleToSave(session, sessionAgent, path.basename(session.projectPath));
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
    Stream.filter(entityChanges, ({kind}) => kind !== ENTITY_CHANGE_KINDS.REMOVED),
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
    Stream.filter(entityChanges, ({kind}) => kind !== ENTITY_CHANGE_KINDS.REMOVED),
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

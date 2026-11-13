import {makeStopAgentsQuestion} from "@applicationUtils/sessionQuestion.utils.ts";
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
import {AGENT_LABELS, AGENT_PICK_TAGS} from "@pkg/constants/src/agent.constant.ts";
import {SESSION_LABELS, SESSION_NOTICES} from "@pkg/constants/src/session.constant.ts";
import {
  addEntity,
  findEntities,
  findEntityById,
  placeEntitiesAtEnd,
  removeEntity,
  updateEntity
} from "@services/base.service.ts";
import {findOrAddProject, findProjectListItem, listProjects, pickProject} from "@services/project.service.ts";
import {ENTITY_CHANGE_KINDS} from "@valueObjects/entityChangeKind.valueObject.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {SESSION_LIFECYCLES} from "@valueObjects/sessionLifecycle.valueObject.ts";
import {SESSION_STATUSES} from "@valueObjects/sessionStatus.valueObject.ts";
import {Array, DateTime, Effect, Match, Predicate, Result, Schema, Stream, String, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {
  ArchiveProjectSessionsRequestDto,
  ArchiveSessionRequestDto,
  GetSessionListItemRequestDto,
  ListArchivedProjectSessionIdsRequestDto,
  ListProjectSessionIdsRequestDto,
  MoveSessionDownRequestDto,
  MoveSessionToPlaceOfRequestDto,
  MoveSessionUpRequestDto,
  NewSessionRequestDto,
  OpenSessionRequestDto,
  RemoveSessionRequestDto,
  RenameSessionRequestDto,
  SessionListChangeDto,
  StopArchivedProjectSessionAgentsRequestDto,
  StopProjectSessionAgentsRequestDto,
  StopSessionAgentRequestDto,
  UnarchiveSessionRequestDto
} from "@dtos/session.dto.ts";
import type {AgentEntity} from "@entities/agent/agent.entity.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {SessionTabRequest} from "@interfaces/terminal.infraService.interface.ts";
import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {SessionLifecycleValueObject} from "@valueObjects/sessionLifecycle.valueObject.ts";

export class NoAgentInstalledError extends Schema.TaggedError<NoAgentInstalledError, {readonly brand: unique symbol}>()(
  "NoAgentInstalledError",
  {searchedCommands: Schema.Array(Schema.String)}
) {}

export class SessionNotFoundError extends Schema.TaggedError<SessionNotFoundError, {readonly brand: unique symbol}>()(
  "SessionNotFoundError",
  {sessionId: EntityIdValueObjectSchema}
) {}

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
    lifecycle: SESSION_LIFECYCLES.ONGOING,
    name: yield* getDefaultSessionName(sessionProject.name, storedSessions),
    projectId: project.id
  });
});

const findSessionAgent = Effect.fn("SessionService.findSessionAgent")(function* (session: SessionEntity) {
  return yield* IAgentRepository.use((agentRepository) => agentRepository.findById(session.agentId));
});

const openSessionTab = Effect.fn("SessionService.openSessionTab")(function* (session: SessionEntity) {
  const tmuxInfraService = yield* ITmuxInfraService;
  const sessionAgent = yield* findSessionAgent(session);
  const launchPlan = yield* prepareLaunchPlan(sessionAgent, session);
  const tabCommand = yield* tmuxInfraService.prepareSessionTabCommand({
    launchPlan,
    projectPath: session.projectPath,
    sessionId: session.id
  });
  const sessionTabRequest: SessionTabRequest = {icon: sessionAgent.icon, tabCommand, tabName: session.displayName};

  yield* ITerminalInfraService.use((terminalInfraService) =>
    terminalInfraService.openSessionTerminal(session, sessionTabRequest)
  );
  yield* tmuxInfraService.waitForSessionAgentStart(session.id);
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
    const pickedAgent = yield* Match.valueTags(agentPick, {
      [AGENT_PICK_TAGS.AGENT_PICKED]: (agentPicked) => findInstalledAgent(installedAgents, agentPicked.agentId),
      [AGENT_PICK_TAGS.DEFAULT_AGENT_CHOSEN]: (defaultAgentChosen) =>
        Effect.as(
          ISettingsConfig.use((settingsConfig) => settingsConfig.saveDefaultAgentId(defaultAgentChosen.agentId)),
          undefined
        )
    });
    if (pickedAgent !== undefined) return pickedAgent;
    defaultAgentId = agentPick.agentId;
  }
});

const chooseAgent = Effect.fn("SessionService.chooseAgent")(function* () {
  const sessionSettings = yield* ISettingsConfig.use((settingsConfig) => settingsConfig.readSessionSettings);
  const installedAgents = yield* listInstalledAgents();
  const [onlyInstalledAgent] = installedAgents;
  if (installedAgents.length === 1 && onlyInstalledAgent !== undefined) return onlyInstalledAgent;
  const defaultAgentResult = yield* Effect.result(findInstalledAgent(installedAgents, sessionSettings.defaultAgentId));
  if (sessionSettings.skipAgentPicker && Result.isSuccess(defaultAgentResult)) return defaultAgentResult.success;

  return yield* pickAgent(installedAgents, sessionSettings.defaultAgentId);
});

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

const reopenSession = Effect.fn("SessionService.reopenSession")(function* (sessionId: EntityIdValueObject) {
  const session = yield* findSession(sessionId);

  yield* openSessionTab(session);
});

const confirmRunningSessionRemoval = Effect.fn("SessionService.confirmRunningSessionRemoval")(function* (
  session: SessionEntity
) {
  yield* IUserInputPromptInfraService.use((userInputPromptInfraService) =>
    userInputPromptInfraService.askQuestion({
      answers: [
        {
          consequence: SESSION_NOTICES.REMOVE_STOPPING_AGENT,
          isDestructive: true,
          label: SESSION_LABELS.CONFIRM_REMOVE
        }
      ],
      question: SESSION_NOTICES.CONFIRM_REMOVE_RUNNING(session.displayName)
    })
  );
});

// A tab that closed meanwhile has nothing left to close.
const closeSessionTab = Effect.fn("SessionService.closeSessionTab")(
  function* (sessionId: EntityIdValueObject) {
    yield* ITerminalInfraService.use((terminalInfraService) => terminalInfraService.closeSessionTerminal(sessionId));
  },
  Effect.catchTag("TerminalNotFoundError", () => Effect.void)
);

// The tab attached to the agent's tmux session has nothing left to show once that session ends.
const stopAgentAndCloseTab = Effect.fn("SessionService.stopAgentAndCloseTab")(function* (
  sessionId: EntityIdValueObject
) {
  yield* ITmuxInfraService.use((tmuxInfraService) => tmuxInfraService.stopSessionAgent(sessionId));
  yield* closeSessionTab(sessionId);
});

// The session is forgotten before its agent stops, so a failed write never kills the agent for nothing.
const removeSessionAndStopAgent = Effect.fn("SessionService.removeSessionAndStopAgent")(function* (
  session: SessionEntity
) {
  const runningSessionIds = yield* ITmuxInfraService.use(
    (tmuxInfraService) => tmuxInfraService.refreshRunningSessionIds
  );
  if (runningSessionIds.has(session.id)) yield* confirmRunningSessionRemoval(session);

  yield* removeEntity(ISessionRepository, session.id);
  yield* stopAgentAndCloseTab(session.id);
});

const findRunningAgentSessions = Effect.fn("SessionService.findRunningAgentSessions")(function* (
  sessions: readonly SessionEntity[]
) {
  const runningSessionIds = yield* ITmuxInfraService.use(
    (tmuxInfraService) => tmuxInfraService.refreshRunningSessionIds
  );
  const runningAgentSessions = Array.filter(sessions, (session) => runningSessionIds.has(session.id));
  const turnRunningSessions = yield* Effect.filter(runningAgentSessions, (runningAgentSession) =>
    Effect.flatMap(getSessionStatus(runningAgentSession, {isAgentRunning: true, isInView: false}), isSessionTurnRunning)
  );

  return {runningAgentSessions, turnRunningSessions};
});

const stopRunningAgentsAsking = Effect.fn("SessionService.stopRunningAgentsAsking")(function* (
  sessions: readonly SessionEntity[]
) {
  const runningAgents = yield* findRunningAgentSessions(sessions);
  if (!Array.isReadonlyArrayNonEmpty(runningAgents.runningAgentSessions)) return;
  if (runningAgents.turnRunningSessions.length > 0) {
    const stopAgentsQuestion = yield* makeStopAgentsQuestion(
      Array.map(runningAgents.runningAgentSessions, (runningAgentSession) => runningAgentSession.displayName),
      runningAgents.turnRunningSessions.length
    );
    yield* IUserInputPromptInfraService.use((userInputPromptInfraService) =>
      userInputPromptInfraService.askQuestion(stopAgentsQuestion)
    );
  }
  yield* Effect.forEach(runningAgents.runningAgentSessions, (runningAgentSession) =>
    stopAgentAndCloseTab(runningAgentSession.id)
  );
});

// Placing them at the end makes the change feed read them as placed, which redraws their projects in both views.
const moveSessionsToLifecycle = Effect.fn("SessionService.moveSessionsToLifecycle")(function* (
  sessionIds: readonly EntityIdValueObject[],
  lifecycle: SessionLifecycleValueObject
) {
  yield* Effect.forEach(sessionIds, (sessionId) => updateEntity(ISessionRepository, sessionId, {lifecycle}));
  yield* placeEntitiesAtEnd(ISessionRepository, sessionIds);
});

// Each agent runs on in tmux and finishes its turn; only its tab closes.
const archiveSessionsKeepingAgents = Effect.fn("SessionService.archiveSessionsKeepingAgents")(function* (
  sessions: readonly SessionEntity[]
) {
  const sessionIds = Array.map(sessions, (session) => session.id);
  yield* moveSessionsToLifecycle(sessionIds, SESSION_LIFECYCLES.ARCHIVED);
  yield* Effect.forEach(sessionIds, (sessionId) => closeSessionTab(sessionId));
});

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

export const openSession = Effect.fn("SessionService.openSession")(
  function* (request: OpenSessionRequestDto) {
    yield* ITerminalInfraService.use((terminalInfraService) =>
      terminalInfraService.focusSessionTerminal(request.sessionId)
    );
  },
  (effect, request) => Effect.catchTag(effect, "TerminalNotFoundError", () => reopenSession(request.sessionId))
);

// The agent's transcript on disk is left alone.
export const removeSession = Effect.fn("SessionService.removeSession")(
  function* (request: RemoveSessionRequestDto) {
    const session = yield* findSession(request.sessionId);
    yield* removeSessionAndStopAgent(session);
  },
  Effect.catchTags({QuestionCancelledError: () => Effect.void, SessionNotFoundError: () => Effect.void})
);

export const archiveSession = Effect.fn("SessionService.archiveSession")(
  function* (request: ArchiveSessionRequestDto) {
    const session = yield* findSession(request.sessionId);
    if (session.lifecycle === SESSION_LIFECYCLES.ARCHIVED) return;

    yield* archiveSessionsKeepingAgents([session]);
  },
  Effect.catchTags({EntityNotFoundError: () => Effect.void, SessionNotFoundError: () => Effect.void})
);

export const unarchiveSession = Effect.fn("SessionService.unarchiveSession")(
  function* (request: UnarchiveSessionRequestDto) {
    const session = yield* findSession(request.sessionId);
    if (session.lifecycle === SESSION_LIFECYCLES.ONGOING) return;

    yield* moveSessionsToLifecycle([session.id], SESSION_LIFECYCLES.ONGOING);
  },
  Effect.catchTags({EntityNotFoundError: () => Effect.void, SessionNotFoundError: () => Effect.void})
);

// An empty name hands the row and the tab back to the agent's title.
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

const findSessionPlaceInProject = Effect.fn("SessionService.findSessionPlaceInProject")(function* (
  sessionId: EntityIdValueObject
) {
  const session = yield* findSession(sessionId);
  const projectSessions = yield* findEntities(ISessionRepository, {
    lifecycle: session.lifecycle,
    projectId: session.projectId
  });
  const projectSessionIds = Array.map(projectSessions, (projectSession) => projectSession.id);

  return {projectSessionIds, sessionIndex: projectSessionIds.indexOf(sessionId)};
});

export const moveSessionUp = Effect.fn("SessionService.moveSessionUp")(
  function* (request: MoveSessionUpRequestDto) {
    const sessionPlace = yield* findSessionPlaceInProject(request.sessionId);
    const sessionIdsToPlaceAtEnd = yield* findEntityIdsToPlaceAtEnd(
      sessionPlace.projectSessionIds,
      sessionPlace.sessionIndex,
      sessionPlace.sessionIndex - 1
    );
    yield* placeEntitiesAtEnd(ISessionRepository, sessionIdsToPlaceAtEnd);
  },
  Effect.catchTag("SessionNotFoundError", () => Effect.void)
);

export const moveSessionDown = Effect.fn("SessionService.moveSessionDown")(
  function* (request: MoveSessionDownRequestDto) {
    const sessionPlace = yield* findSessionPlaceInProject(request.sessionId);
    const sessionIdsToPlaceAtEnd = yield* findEntityIdsToPlaceAtEnd(
      sessionPlace.projectSessionIds,
      sessionPlace.sessionIndex,
      sessionPlace.sessionIndex + 1
    );
    yield* placeEntitiesAtEnd(ISessionRepository, sessionIdsToPlaceAtEnd);
  },
  Effect.catchTag("SessionNotFoundError", () => Effect.void)
);

// A session moves only among its project's sessions, so the place of another project's session moves nothing.
export const moveSessionToPlaceOf = Effect.fn("SessionService.moveSessionToPlaceOf")(
  function* (request: MoveSessionToPlaceOfRequestDto) {
    const sessionPlace = yield* findSessionPlaceInProject(request.sessionId);
    const placeIndex = sessionPlace.projectSessionIds.indexOf(request.placeOfSessionId);
    const sessionIdsToPlaceAtEnd = yield* findEntityIdsToPlaceAtEnd(
      sessionPlace.projectSessionIds,
      sessionPlace.sessionIndex,
      placeIndex
    );
    yield* placeEntitiesAtEnd(ISessionRepository, sessionIdsToPlaceAtEnd);
  },
  Effect.catchTag("SessionNotFoundError", () => Effect.void)
);

const findSessionMoves = Effect.fn("SessionService.findSessionMoves")(function* (
  session: SessionEntity,
  orderedSessions: readonly SessionEntity[]
) {
  const projectSessions = Array.filter(
    orderedSessions,
    (orderedSession) => orderedSession.projectId === session.projectId && orderedSession.lifecycle === session.lifecycle
  );
  const projectSessionIds = Array.map(projectSessions, (projectSession) => projectSession.id);

  return {
    canMoveDown: yield* canMoveDownInOrder(projectSessionIds, session.id),
    canMoveUp: yield* canMoveUpInOrder(projectSessionIds, session.id)
  };
});

const findSessionAgentFields = Effect.fn("SessionService.findSessionAgentFields")(function* (session: SessionEntity) {
  const agentResult = yield* Effect.result(findSessionAgent(session));

  return Result.match(agentResult, {
    onFailure: () => ({}),
    onSuccess: (sessionAgent) => ({agentName: sessionAgent.name, icon: sessionAgent.icon})
  });
});

const toSessionListItem = Effect.fn("SessionService.toSessionListItem")(function* (
  session: SessionEntity,
  orderedSessions: readonly SessionEntity[]
) {
  const terminalInfraService = yield* ITerminalInfraService;
  const tmuxInfraService = yield* ITmuxInfraService;
  const path = yield* Path;
  const runningSessionIds = yield* SubscriptionRef.get(tmuxInfraService.runningSessionIds);
  const viewedSessionIdResult = yield* SubscriptionRef.get(terminalInfraService.viewedSessionId);
  const isInView = Result.getOrUndefined(viewedSessionIdResult) === session.id;
  const status = yield* getSessionStatus(session, {isAgentRunning: runningSessionIds.has(session.id), isInView});
  const isTurnRunning = yield* isSessionTurnRunning(status);

  return SessionListItemDtoSchema.make({
    ...(yield* findSessionMoves(session, orderedSessions)),
    ...(yield* findSessionAgentFields(session)),
    displayName: session.displayName,
    isAgentRunning: runningSessionIds.has(session.id),
    isArchived: session.lifecycle === SESSION_LIFECYCLES.ARCHIVED,
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

// A workspace folder without a session has no project row yet.
const findProjectSessions = Effect.fn("SessionService.findProjectSessions")(function* (
  projectPath: ProjectPathValueObject,
  lifecycle: SessionLifecycleValueObject
) {
  const [storedProject] = yield* findEntities(IProjectRepository, {path: projectPath});
  if (storedProject === undefined) return [];

  return yield* findEntities(ISessionRepository, {lifecycle, projectId: storedProject.id});
});

const findProjectSessionIds = Effect.fn("SessionService.findProjectSessionIds")(function* (
  projectPath: ProjectPathValueObject,
  lifecycle: SessionLifecycleValueObject
) {
  const projectSessions = yield* findProjectSessions(projectPath, lifecycle);

  return Array.map(projectSessions, (projectSession) => projectSession.id);
});

const findListedSessions = Effect.fn("SessionService.findListedSessions")(function* (
  lifecycle: SessionLifecycleValueObject
) {
  const projectListItems = yield* listProjects();
  const listedProjectPaths = new Set(Array.map(projectListItems, (projectListItem) => projectListItem.path));
  const sessions = yield* findEntities(ISessionRepository, {lifecycle});

  return Array.filter(sessions, (session) => listedProjectPaths.has(session.projectPath));
});

export const listProjectSessionIds = Effect.fn("SessionService.listProjectSessionIds")(function* (
  request: ListProjectSessionIdsRequestDto
) {
  return yield* findProjectSessionIds(request.projectPath, SESSION_LIFECYCLES.ONGOING);
});

export const listArchivedProjectSessionIds = Effect.fn("SessionService.listArchivedProjectSessionIds")(function* (
  request: ListArchivedProjectSessionIdsRequestDto
) {
  return yield* findProjectSessionIds(request.projectPath, SESSION_LIFECYCLES.ARCHIVED);
});

// A project no longer listed hides its archived sessions, as it does its others.
export const listProjectsWithArchivedSessions = Effect.fn("SessionService.listProjectsWithArchivedSessions")(
  function* () {
    const archivedSessions = yield* findEntities(ISessionRepository, {lifecycle: SESSION_LIFECYCLES.ARCHIVED});
    const archivedSessionProjectPaths = new Set(
      Array.map(archivedSessions, (archivedSession) => archivedSession.projectPath)
    );
    const projectListItems = yield* listProjects();

    return Array.filter(projectListItems, (projectListItem) => archivedSessionProjectPaths.has(projectListItem.path));
  }
);

export const archiveProjectSessions = Effect.fn("SessionService.archiveProjectSessions")(
  function* (request: ArchiveProjectSessionsRequestDto) {
    const projectSessions = yield* findProjectSessions(request.projectPath, SESSION_LIFECYCLES.ONGOING);
    yield* archiveSessionsKeepingAgents(projectSessions);
  },
  Effect.catchTag("EntityNotFoundError", () => Effect.void)
);

export const archiveOngoingSessions = Effect.fn("SessionService.archiveOngoingSessions")(
  function* () {
    const listedSessions = yield* findListedSessions(SESSION_LIFECYCLES.ONGOING);
    yield* archiveSessionsKeepingAgents(listedSessions);
  },
  Effect.catchTag("EntityNotFoundError", () => Effect.void)
);

export const stopSessionAgent = Effect.fn("SessionService.stopSessionAgent")(
  function* (request: StopSessionAgentRequestDto) {
    const session = yield* findSession(request.sessionId);
    yield* stopRunningAgentsAsking([session]);
  },
  Effect.catchTags({QuestionCancelledError: () => Effect.void, SessionNotFoundError: () => Effect.void})
);

export const stopProjectSessionAgents = Effect.fn("SessionService.stopProjectSessionAgents")(
  function* (request: StopProjectSessionAgentsRequestDto) {
    const projectSessions = yield* findProjectSessions(request.projectPath, SESSION_LIFECYCLES.ONGOING);
    yield* stopRunningAgentsAsking(projectSessions);
  },
  Effect.catchTag("QuestionCancelledError", () => Effect.void)
);

export const stopArchivedProjectSessionAgents = Effect.fn("SessionService.stopArchivedProjectSessionAgents")(
  function* (request: StopArchivedProjectSessionAgentsRequestDto) {
    const projectSessions = yield* findProjectSessions(request.projectPath, SESSION_LIFECYCLES.ARCHIVED);
    yield* stopRunningAgentsAsking(projectSessions);
  },
  Effect.catchTag("QuestionCancelledError", () => Effect.void)
);

export const stopOngoingSessionAgents = Effect.fn("SessionService.stopOngoingSessionAgents")(
  function* () {
    const listedSessions = yield* findListedSessions(SESSION_LIFECYCLES.ONGOING);
    yield* stopRunningAgentsAsking(listedSessions);
  },
  Effect.catchTag("QuestionCancelledError", () => Effect.void)
);

export const stopArchivedSessionAgents = Effect.fn("SessionService.stopArchivedSessionAgents")(
  function* () {
    const listedSessions = yield* findListedSessions(SESSION_LIFECYCLES.ARCHIVED);
    yield* stopRunningAgentsAsking(listedSessions);
  },
  Effect.catchTag("QuestionCancelledError", () => Effect.void)
);

export const listSessionsWaitingOnUser = Effect.fn("SessionService.listSessionsWaitingOnUser")(function* () {
  const storedSessions = yield* findEntities(ISessionRepository, {});
  const sessionListItems = yield* Effect.forEach(storedSessions, (storedSession) =>
    toSessionListItem(storedSession, storedSessions)
  );

  return yield* Effect.filter(sessionListItems, (sessionListItem) => isSessionWaitingOnUser(sessionListItem.status));
});

// Coming into or leaving view writes viewedAt, so it arrives as a write.
export const watchSessionListChanges = Effect.fn("SessionService.watchSessionListChanges")(function* () {
  const projectRepository = yield* IProjectRepository;
  const sessionRepository = yield* ISessionRepository;
  const tmuxInfraService = yield* ITmuxInfraService;
  const workspaceInfraService = yield* IWorkspaceInfraService;
  const sessionListChangeSources: readonly Stream.Stream<SessionListChangeDto>[] = [
    Stream.as(
      Stream.merge(projectRepository.entityChanges, workspaceInfraService.workspaceFolderChanges),
      SessionListChangeDtoSchema.cases.ProjectListChanged.make({})
    ),
    Stream.map(sessionRepository.entityChanges, (sessionChange) =>
      sessionChange.kind === ENTITY_CHANGE_KINDS.UPDATED
        ? SessionListChangeDtoSchema.cases.SessionChanged.make({sessionId: sessionChange.entity.id})
        : SessionListChangeDtoSchema.cases.ProjectSessionsChanged.make({projectPath: sessionChange.entity.projectPath})
    ),
    Stream.map(tmuxInfraService.startedOrStoppedSessionIds, (sessionId) =>
      SessionListChangeDtoSchema.cases.SessionChanged.make({sessionId})
    )
  ];

  return Stream.mergeAll(sessionListChangeSources, {concurrency: "unbounded"});
});

export const watchViewedSessionIds = Effect.fn("SessionService.watchViewedSessionIds")(function* () {
  const terminalInfraService = yield* ITerminalInfraService;

  return Stream.filterMap(
    SubscriptionRef.changes(terminalInfraService.viewedSessionId),
    (viewedSessionIdResult) => viewedSessionIdResult
  );
});

export const findViewedSessionId = Effect.fn("SessionService.findViewedSessionId")(function* () {
  const terminalInfraService = yield* ITerminalInfraService;
  const viewedSessionIdResult = yield* SubscriptionRef.get(terminalInfraService.viewedSessionId);

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

// The check runs on every write to a session, so it is untraced; only a save shows in the trace.
export const startSessionTitleSync = Effect.fn("SessionService.startSessionTitleSync")(function* () {
  const sessionRepository = yield* ISessionRepository;
  const writtenSessions = Stream.map(
    Stream.filter(
      sessionRepository.entityChanges,
      (sessionChange) => sessionChange.kind !== ENTITY_CHANGE_KINDS.REMOVED
    ),
    (sessionChange) => sessionChange.entity
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

// No command started this, so a failure is logged; a removed session has no tab to name.
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

// VS Code renames only the active terminal, so a tab out of front takes a new name when it next comes to the front.
export const startSessionTabNameSync = Effect.fn("SessionService.startSessionTabNameSync")(function* () {
  const sessionRepository = yield* ISessionRepository;
  const terminalInfraService = yield* ITerminalInfraService;
  const writtenSessions = Stream.map(
    Stream.filter(
      sessionRepository.entityChanges,
      (sessionChange) => sessionChange.kind !== ENTITY_CHANGE_KINDS.REMOVED
    ),
    (sessionChange) => sessionChange.entity
  );
  const writtenOrActivatedSessions = Stream.merge(writtenSessions, terminalInfraService.activatedSessionIds);

  yield* Effect.forkScoped(
    Stream.runForEach(writtenOrActivatedSessions, (writtenOrActivatedSession) =>
      Effect.withTracerEnabled(nameSessionTab(writtenOrActivatedSession), false)
    )
  );
});

// No command started this, so a failure is logged.
const recordViewedAt = Effect.fn("SessionService.recordViewedAt")(
  function* (sessionId: EntityIdValueObject) {
    const viewedAt = yield* DateTime.now;
    yield* updateEntity(ISessionRepository, sessionId, {viewedAt});
  },
  Effect.catchTag("EntityNotFoundError", () => Effect.void),
  Effect.catch((writeError) => Effect.logWarning("Could not record when the session was in view", writeError))
);

// Both sessions get viewedAt, so a turn that ended before then counts as seen, in every window and after a restart.
export const startViewedAtSync = Effect.fn("SessionService.startViewedAtSync")(function* () {
  const terminalInfraService = yield* ITerminalInfraService;
  const enteringAndLeavingSessionIds = Stream.mapAccum(
    SubscriptionRef.changes(terminalInfraService.viewedSessionId),
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

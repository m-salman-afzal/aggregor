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
import {
  getTitledBranchName,
  getWorktreeBranchName,
  getWorktreeName,
  getWorktreesFolderName,
  hasWorktreeBranchFirstName
} from "@domainServices/worktree.domainService.ts";
import {
  ProjectSessionsDtoSchema,
  SessionListChangeDtoSchema,
  SessionListItemDtoSchema,
  WorktreeListItemDtoSchema
} from "@dtos/session.dto.ts";
import {IAgentRepository} from "@entities/agent/agent.repository.interface.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {ITmuxInfraService} from "@interfaces/tmux.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {IWorktreeInfraService} from "@interfaces/worktree.infraService.interface.ts";
import {NEW_SESSION_WORKING_TREE_TAGS} from "@pkg/constants/src/session.constant.ts";
import {findAgentToStart} from "@services/agent.service.ts";
import {
  addEntity,
  findEntities,
  findEntityById,
  placeEntitiesAtEnd,
  removeEntity,
  updateEntity
} from "@services/base.service.ts";
import {findOrAddProject, findProjectListItem, listProjects} from "@services/project.service.ts";
import {hasProjectLeftovers, removeSessionWorktree} from "@services/worktree.service.ts";
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
  GetProjectSessionsRequestDto,
  GetSessionListItemRequestDto,
  MoveSessionDownRequestDto,
  MoveSessionUpRequestDto,
  NewSessionRequestDto,
  OpenSessionRequestDto,
  RemoveSessionRequestDto,
  RenameSessionBranchRequestDto,
  RenameSessionRequestDto,
  SessionListChangeDto,
  StopArchivedProjectSessionAgentsRequestDto,
  StopProjectSessionAgentsRequestDto,
  StopSessionAgentRequestDto,
  UnarchiveSessionRequestDto
} from "@dtos/session.dto.ts";
import type {AgentEntity} from "@entities/agent/agent.entity.ts";
import type {ProjectEntity} from "@entities/project/project.entity.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {SessionTabRequest} from "@interfaces/terminal.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {SessionLifecycleValueObject} from "@valueObjects/sessionLifecycle.valueObject.ts";

interface NewSessionDraft {
  readonly project: ProjectEntity;
  readonly projectName: string;
  readonly sessionAgent: AgentEntity;
  readonly sessionName: string;
}

export class SessionNotInWorktreeError extends Schema.TaggedError<
  SessionNotInWorktreeError,
  {readonly brand: unique symbol}
>()("SessionNotInWorktreeError", {}) {}

export class WorktreeNotFoundError extends Schema.TaggedError<WorktreeNotFoundError, {readonly brand: unique symbol}>()(
  "WorktreeNotFoundError",
  {}
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
  newSessionDraft: NewSessionDraft,
  worktreePath: ProjectPathValueObject | undefined
) {
  return yield* addEntity(ISessionRepository, {
    agentId: newSessionDraft.sessionAgent.id,
    lifecycle: SESSION_LIFECYCLES.ONGOING,
    name: newSessionDraft.sessionName,
    projectId: newSessionDraft.project.id,
    worktreePath
  });
});

// Each is named after the session: "jsTester #3" works in jstester-3, on aggregor/jstester-3.
const createSessionWorktree = Effect.fn("SessionService.createSessionWorktree")(function* (
  newSessionDraft: NewSessionDraft
) {
  const worktreeInfraService = yield* IWorktreeInfraService;
  const worktreeName = yield* getWorktreeName(newSessionDraft.sessionName);
  const sessionWorktree = yield* worktreeInfraService.createWorktree({
    branchName: yield* getWorktreeBranchName(worktreeName),
    projectPath: newSessionDraft.project.path,
    worktreeName,
    worktreesFolderName: yield* getWorktreesFolderName(newSessionDraft.projectName, newSessionDraft.project.id),
    worktreesFolderPath: newSessionDraft.project.settings.worktreeFolder
  });
  yield* worktreeInfraService.copyIncludedFiles({
    filePatterns: newSessionDraft.project.settings.filesToCopy,
    projectPath: newSessionDraft.project.path,
    worktreePath: sessionWorktree.worktreePath
  });

  return sessionWorktree.worktreePath;
});

const findExistingWorktree = Effect.fn("SessionService.findExistingWorktree")(
  function* (projectPath: ProjectPathValueObject, worktreePath: ProjectPathValueObject) {
    const projectWorktrees = yield* IWorktreeInfraService.use((worktreeInfraService) =>
      worktreeInfraService.listWorktrees(projectPath)
    );
    if (!Array.some(projectWorktrees, (projectWorktree) => projectWorktree.worktreePath === worktreePath))
      return yield* WorktreeNotFoundError.make();

    return worktreePath;
  },
  Effect.catchTag("NotGitRepositoryError", () => Effect.fail(WorktreeNotFoundError.make()))
);

const prepareSessionWorkingTree = Effect.fn("SessionService.prepareSessionWorkingTree")(function* (
  newSessionDraft: NewSessionDraft,
  workingTree: NewSessionRequestDto["workingTree"]
) {
  return yield* Match.valueTags(workingTree, {
    [NEW_SESSION_WORKING_TREE_TAGS.EXISTING_WORKTREE]: (existingWorktree) =>
      Effect.map(findExistingWorktree(newSessionDraft.project.path, existingWorktree.worktreePath), (worktreePath) => ({
        setupScript: undefined,
        worktreePath
      })),
    [NEW_SESSION_WORKING_TREE_TAGS.NEW_WORKTREE]: () =>
      Effect.map(createSessionWorktree(newSessionDraft), (worktreePath) => ({
        setupScript: newSessionDraft.project.settings.setupScript,
        worktreePath
      })),
    [NEW_SESSION_WORKING_TREE_TAGS.PROJECT_ROOT]: () =>
      Effect.succeed({setupScript: undefined, worktreePath: undefined})
  });
});

const findSessionAgent = Effect.fn("SessionService.findSessionAgent")(function* (session: SessionEntity) {
  return yield* IAgentRepository.use((agentRepository) => agentRepository.findById(session.agentId));
});

const openSessionTab = Effect.fn("SessionService.openSessionTab")(function* (
  session: SessionEntity,
  setupScript: string | undefined
) {
  const tmuxInfraService = yield* ITmuxInfraService;
  const sessionAgent = yield* findSessionAgent(session);
  const launchPlan = yield* prepareLaunchPlan(sessionAgent, session);
  const tabCommand = yield* tmuxInfraService.prepareSessionTabCommand({
    launchPlan,
    sessionId: session.id,
    setupScript,
    workingFolderPath: session.workingFolderPath
  });
  const sessionTabRequest: SessionTabRequest = {icon: sessionAgent.icon, tabCommand, tabName: session.displayName};

  yield* ITerminalInfraService.use((terminalInfraService) =>
    terminalInfraService.openSessionTerminal(session, sessionTabRequest)
  );
  yield* tmuxInfraService.waitForSessionAgentStart(session.id);
});

// A new session whose tab fails to open is removed again, with any agent it started, so no dead row stays behind.
const launchNewSession = Effect.fn("SessionService.launchNewSession")(
  function* (addedSession: SessionEntity, setupScript: string | undefined) {
    yield* openSessionTab(addedSession, setupScript);
  },
  (effect, addedSession) =>
    Effect.tapError(effect, () =>
      Effect.andThen(
        removeEntity(ISessionRepository, addedSession.id),
        ITmuxInfraService.use((tmuxInfraService) => tmuxInfraService.stopSessionAgent(addedSession.id))
      )
    )
);

const reopenSession = Effect.fn("SessionService.reopenSession")(function* (sessionId: EntityIdValueObject) {
  const session = yield* findSession(sessionId);

  yield* openSessionTab(session, undefined);
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

// The worktree goes first and the session is forgotten next, so a refusal or a failed write never kills the agent.
const removeSessionAndStopAgent = Effect.fn("SessionService.removeSessionAndStopAgent")(function* (
  session: SessionEntity
) {
  yield* removeSessionWorktree(session);
  yield* removeEntity(ISessionRepository, session.id);
  yield* stopAgentAndCloseTab(session.id);
});

const stopRunningAgents = Effect.fn("SessionService.stopRunningAgents")(function* (sessions: readonly SessionEntity[]) {
  const runningSessionIds = yield* ITmuxInfraService.use(
    (tmuxInfraService) => tmuxInfraService.refreshRunningSessionIds
  );
  const runningAgentSessions = Array.filter(sessions, (session) => runningSessionIds.has(session.id));

  yield* Effect.forEach(runningAgentSessions, (runningAgentSession) => stopAgentAndCloseTab(runningAgentSession.id));
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

// A project no longer listed starts nothing.
export const newSession = Effect.fn("SessionService.newSession")(
  function* (request: NewSessionRequestDto) {
    const sessionProject = yield* findProjectListItem(request.projectPath);
    const storedSessions = yield* findEntities(ISessionRepository, {});
    const newSessionDraft: NewSessionDraft = {
      project: yield* findOrAddProject(sessionProject.path),
      projectName: sessionProject.name,
      sessionAgent: yield* findAgentToStart(request.agentId),
      sessionName: yield* getDefaultSessionName(sessionProject.name, storedSessions)
    };
    const sessionWorkingTree = yield* prepareSessionWorkingTree(newSessionDraft, request.workingTree);
    const addedSession = yield* addSession(newSessionDraft, sessionWorkingTree.worktreePath);

    yield* launchNewSession(addedSession, sessionWorkingTree.setupScript);
  },
  Effect.catchTag("ProjectNotListedError", () => Effect.void)
);

export const openSession = Effect.fn("SessionService.openSession")(
  function* (request: OpenSessionRequestDto) {
    yield* ITerminalInfraService.use((terminalInfraService) =>
      terminalInfraService.focusSessionTerminal(request.sessionId)
    );
  },
  (effect, request) => Effect.catchTag(effect, "TerminalNotFoundError", () => reopenSession(request.sessionId))
);

// The agent's transcript on disk and the worktree's branch are left alone.
export const removeSession = Effect.fn("SessionService.removeSession")(
  function* (request: RemoveSessionRequestDto) {
    const session = yield* findSession(request.sessionId);
    yield* removeSessionAndStopAgent(session);
  },
  Effect.catchTag("SessionNotFoundError", () => Effect.void)
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

// The rename writes nothing of the session's, so touching its row is what makes the change feed redraw it.
export const renameSessionBranch = Effect.fn("SessionService.renameSessionBranch")(
  function* (request: RenameSessionBranchRequestDto) {
    const session = yield* findSession(request.sessionId);
    const worktreePath = session.worktreePath;
    if (worktreePath === undefined) return yield* SessionNotInWorktreeError.make();
    yield* IWorktreeInfraService.use((worktreeInfraService) =>
      worktreeInfraService.renameBranch(worktreePath, String.trim(request.branchName))
    );

    return yield* updateEntity(ISessionRepository, session.id, {});
  },
  Effect.catchTags({EntityNotFoundError: () => Effect.void, SessionNotFoundError: () => Effect.void})
);

export const renameSession = Effect.fn("SessionService.renameSession")(
  function* (request: RenameSessionRequestDto) {
    const trimmedName = String.trim(request.customName);

    yield* updateEntity(ISessionRepository, request.sessionId, {
      customName: trimmedName === "" ? undefined : trimmedName
    });
  },
  Effect.catchTag("EntityNotFoundError", () => Effect.void)
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

const findSessionBranchFields = Effect.fn("SessionService.findSessionBranchFields")(function* (session: SessionEntity) {
  const worktreePath = session.worktreePath;
  if (worktreePath === undefined) return {};
  const branchNameResult = yield* Effect.result(
    IWorktreeInfraService.use((worktreeInfraService) => worktreeInfraService.readBranchName(worktreePath))
  );

  return Result.match(branchNameResult, {onFailure: () => ({}), onSuccess: (branchName) => ({branchName})});
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
    ...(yield* findSessionBranchFields(session)),
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
    statusProgress: isTurnRunning ? session.statusProgress : undefined,
    worktreePath: session.worktreePath
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

const findListedSessions = Effect.fn("SessionService.findListedSessions")(function* (
  lifecycle: SessionLifecycleValueObject
) {
  const projectListItems = yield* listProjects();
  const listedProjectPaths = new Set(Array.map(projectListItems, (projectListItem) => projectListItem.path));
  const sessions = yield* findEntities(ISessionRepository, {lifecycle});

  return Array.filter(sessions, (session) => listedProjectPaths.has(session.projectPath));
});

const findProjectWorktrees = Effect.fn("SessionService.findProjectWorktrees")(function* (
  projectListItem: ProjectListItemDto,
  lifecycle: SessionLifecycleValueObject
) {
  if (lifecycle === SESSION_LIFECYCLES.ARCHIVED) return {};
  const projectWorktreesResult = yield* Effect.result(
    IWorktreeInfraService.use((worktreeInfraService) => worktreeInfraService.listWorktrees(projectListItem.path))
  );
  const hasLeftovers = yield* hasProjectLeftovers(projectListItem);
  const worktreesRootPath = yield* IWorktreeInfraService.use((worktreeInfraService) =>
    worktreeInfraService.findWorktreesRootPath(projectListItem.settings.worktreeFolder)
  );

  return Result.match(projectWorktreesResult, {
    onFailure: () => ({}),
    onSuccess: (projectWorktrees) => ({
      hasLeftovers,
      worktrees: Array.map(projectWorktrees, (projectWorktree) =>
        WorktreeListItemDtoSchema.make({
          branchName: projectWorktree.branchName,
          worktreePath: projectWorktree.worktreePath
        })
      ),
      worktreesRootPath
    })
  });
});

const toProjectSessions = Effect.fn("SessionService.toProjectSessions")(function* (
  projectListItem: ProjectListItemDto,
  lifecycleSessions: readonly SessionEntity[],
  lifecycle: SessionLifecycleValueObject
) {
  const projectSessions = Array.filter(
    lifecycleSessions,
    (lifecycleSession) => lifecycleSession.projectPath === projectListItem.path
  );

  return ProjectSessionsDtoSchema.make({
    ...(yield* findProjectWorktrees(projectListItem, lifecycle)),
    projectListItem,
    sessionListItems: yield* Effect.forEach(projectSessions, (projectSession) =>
      toSessionListItem(projectSession, projectSessions)
    )
  });
});

const listProjectsWithLifecycleSessions = Effect.fn("SessionService.listProjectsWithLifecycleSessions")(function* (
  lifecycle: SessionLifecycleValueObject
) {
  const projectListItems = yield* listProjects();
  const lifecycleSessions = yield* findEntities(ISessionRepository, {lifecycle});

  return yield* Effect.forEach(projectListItems, (projectListItem) =>
    toProjectSessions(projectListItem, lifecycleSessions, lifecycle)
  );
});

// A project no longer listed draws nothing: the change that unlisted it redraws every project.
export const getProjectSessions = Effect.fn("SessionService.getProjectSessions")(function* (
  request: GetProjectSessionsRequestDto
) {
  const projectListItem = yield* findProjectListItem(request.projectPath);
  const ongoingSessions = yield* findEntities(ISessionRepository, {lifecycle: SESSION_LIFECYCLES.ONGOING});

  return yield* toProjectSessions(projectListItem, ongoingSessions, SESSION_LIFECYCLES.ONGOING);
});

export const listProjectsWithSessions = Effect.fn("SessionService.listProjectsWithSessions")(function* () {
  return yield* listProjectsWithLifecycleSessions(SESSION_LIFECYCLES.ONGOING);
});

// A project no longer listed hides its archived sessions, as it does its others.
export const listProjectsWithArchivedSessions = Effect.fn("SessionService.listProjectsWithArchivedSessions")(
  function* () {
    const projectsWithArchivedSessions = yield* listProjectsWithLifecycleSessions(SESSION_LIFECYCLES.ARCHIVED);

    return Array.filter(
      projectsWithArchivedSessions,
      (projectWithArchivedSessions) => projectWithArchivedSessions.sessionListItems.length > 0
    );
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
    yield* stopRunningAgents([session]);
  },
  Effect.catchTag("SessionNotFoundError", () => Effect.void)
);

export const stopProjectSessionAgents = Effect.fn("SessionService.stopProjectSessionAgents")(function* (
  request: StopProjectSessionAgentsRequestDto
) {
  const projectSessions = yield* findProjectSessions(request.projectPath, SESSION_LIFECYCLES.ONGOING);
  yield* stopRunningAgents(projectSessions);
});

export const stopArchivedProjectSessionAgents = Effect.fn("SessionService.stopArchivedProjectSessionAgents")(function* (
  request: StopArchivedProjectSessionAgentsRequestDto
) {
  const projectSessions = yield* findProjectSessions(request.projectPath, SESSION_LIFECYCLES.ARCHIVED);
  yield* stopRunningAgents(projectSessions);
});

export const stopOngoingSessionAgents = Effect.fn("SessionService.stopOngoingSessionAgents")(function* () {
  const listedSessions = yield* findListedSessions(SESSION_LIFECYCLES.ONGOING);
  yield* stopRunningAgents(listedSessions);
});

export const stopArchivedSessionAgents = Effect.fn("SessionService.stopArchivedSessionAgents")(function* () {
  const listedSessions = yield* findListedSessions(SESSION_LIFECYCLES.ARCHIVED);
  yield* stopRunningAgents(listedSessions);
});

export const listSessionsWaitingOnUser = Effect.fn("SessionService.listSessionsWaitingOnUser")(function* () {
  const storedSessions = yield* findEntities(ISessionRepository, {});
  const sessionListItems = yield* Effect.forEach(storedSessions, (storedSession) =>
    toSessionListItem(storedSession, storedSessions)
  );

  return yield* Effect.filter(sessionListItems, (sessionListItem) => isSessionWaitingOnUser(sessionListItem.status));
});

// An archived session's worktree is left over once its agent stops, which changes its project's cleanup dot.
const toAgentRunChange = Effect.fn("SessionService.toAgentRunChange")(function* (sessionId: EntityIdValueObject) {
  const sessionResult = yield* Effect.result(findSession(sessionId));
  const sessionChanged = SessionListChangeDtoSchema.cases.SessionChanged.make({sessionId});
  if (Result.isFailure(sessionResult)) return sessionChanged;
  const session = sessionResult.success;
  const isWorktreeLeftOver = session.lifecycle === SESSION_LIFECYCLES.ARCHIVED && session.worktreePath !== undefined;

  return isWorktreeLeftOver
    ? SessionListChangeDtoSchema.cases.ProjectSessionsChanged.make({projectPath: session.projectPath})
    : sessionChanged;
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
    Stream.mapEffect(tmuxInfraService.startedOrStoppedSessionIds, (sessionId) =>
      Effect.provideService(toAgentRunChange(sessionId), ISessionRepository, sessionRepository)
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

// Only a branch with the name Aggregor gave it, never pushed, takes the title, so this renames it once.
const renameBranchAfterTitle = Effect.fn("SessionService.renameBranchAfterTitle")(
  function* (worktreePath: ProjectPathValueObject, sessionTitle: string) {
    const worktreeInfraService = yield* IWorktreeInfraService;
    const path = yield* Path;
    const branchName = yield* worktreeInfraService.readBranchName(worktreePath);
    const hasFirstName = yield* hasWorktreeBranchFirstName(branchName, path.basename(worktreePath));
    if (!hasFirstName || (yield* worktreeInfraService.hasUpstream(worktreePath))) return;
    const titledBranchName = yield* getTitledBranchName(sessionTitle);
    const freeBranchName = yield* worktreeInfraService.findFreeBranchName(worktreePath, titledBranchName);

    yield* worktreeInfraService.renameBranch(worktreePath, freeBranchName);
  },
  Effect.catch((renameError) => Effect.logWarning("Could not name the session's branch after its title", renameError))
);

// Nothing shows the failure: no command started this, so it is logged; the branch goes first, so one redraw shows both.
const saveSessionTitle = Effect.fn("SessionService.saveSessionTitle")(
  function* (session: SessionEntity, sessionTitle: string) {
    if (session.worktreePath !== undefined) yield* renameBranchAfterTitle(session.worktreePath, sessionTitle);
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

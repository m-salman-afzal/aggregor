import {getAgentTaskKind} from "@domainServices/agentTask.domainService.ts";
import {
  getAgentConversationId,
  getDefaultSessionName,
  getSessionStatus,
  getSessionTasks,
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
  SessionPageDtoSchema,
  SessionPullRequestDtoSchema,
  SessionTaskDtoSchema,
  WorkingTreeChoiceDtoSchema,
  WorktreeListItemDtoSchema
} from "@dtos/session.dto.ts";
import {IAgentRepository} from "@entities/agent/agent.repository.interface.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {IGitHubCliInfraService} from "@interfaces/gitHubCli.infraService.interface.ts";
import {ISettingsConfig} from "@interfaces/settings.config.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {ITmuxInfraService} from "@interfaces/tmux.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {IWorktreeInfraService} from "@interfaces/worktree.infraService.interface.ts";
import {GIT_COMMAND} from "@pkg/constants/src/git.constant.ts";
import {SESSION_PAGES, SESSION_RUN_STATE, WORKING_TREE_CHOICE_TAGS} from "@pkg/constants/src/session.constant.ts";
import {SESSION_OPEN_PLACES} from "@pkg/constants/src/terminal.constant.ts";
import {findAgentToStart} from "@services/agent.service.ts";
import {
  addEntity,
  findEntities,
  findEntityById,
  findEntityPage,
  placeEntitiesAtEnd,
  removeEntity,
  updateEntity
} from "@services/base.service.ts";
import {findOrAddProject, findProjectListItem, listProjects} from "@services/project.service.ts";
import {hasProjectLeftovers, removeSessionWorktree} from "@services/worktree.service.ts";
import {ENTITY_CHANGE_KINDS} from "@valueObjects/entityChangeKind.valueObject.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {SESSION_LIFECYCLES} from "@valueObjects/sessionLifecycle.valueObject.ts";
import {SESSION_RUN_STATES} from "@valueObjects/sessionRunState.valueObject.ts";
import {SESSION_STATUSES} from "@valueObjects/sessionStatus.valueObject.ts";
import {Array, DateTime, Effect, Match, Predicate, Result, Schema, Stream, String, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {
  ArchiveProjectSessionsRequestDto,
  ArchiveSessionRequestDto,
  ChangeSessionWorkingTreeRequestDto,
  GetProjectSessionsRequestDto,
  GetSessionListItemRequestDto,
  ListProjectSessionsRequestDto,
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
  UnarchiveSessionRequestDto,
  UnlinkSessionWorktreeRequestDto,
  WorkingTreeChoiceDto
} from "@dtos/session.dto.ts";
import type {AgentEntity} from "@entities/agent/agent.entity.ts";
import type {EntityPage} from "@entities/base/base.repository.interface.ts";
import type {ProjectEntity} from "@entities/project/project.entity.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {PullRequestLookup} from "@interfaces/gitHubCli.infraService.interface.ts";
import type {SessionTabRequest} from "@interfaces/terminal.infraService.interface.ts";
import type {AgentTaskValueObject} from "@valueObjects/agentTask.valueObject.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {SessionLifecycleValueObject} from "@valueObjects/sessionLifecycle.valueObject.ts";

interface SessionWorktreeDraft {
  readonly project: ProjectEntity;
  readonly projectName: string;
  readonly sessionName: string;
}

interface NewSessionDraft extends SessionWorktreeDraft {
  readonly sessionAgent: AgentEntity;
}

interface SessionWorkingTree {
  readonly baseBranchName: string | undefined;
  readonly setupScript: string | undefined;
  readonly worktreePath: ProjectPathValueObject | undefined;
}

interface SessionMoves {
  readonly canMoveDown: boolean;
  readonly canMoveUp: boolean;
}

interface SessionListFilter {
  readonly lifecycle: SessionLifecycleValueObject;
  readonly projectId: EntityIdValueObject;
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

class ProjectNotStoredError extends Schema.TaggedError<ProjectNotStoredError, {readonly brand: unique symbol}>()(
  "ProjectNotStoredError",
  {}
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
  sessionWorkingTree: SessionWorkingTree
) {
  return yield* addEntity(ISessionRepository, {
    agentId: newSessionDraft.sessionAgent.id,
    baseBranchName: sessionWorkingTree.baseBranchName,
    lifecycle: SESSION_LIFECYCLES.ONGOING,
    name: newSessionDraft.sessionName,
    projectId: newSessionDraft.project.id,
    worktreePath: sessionWorkingTree.worktreePath
  });
});

// Each is named after the session: "jsTester #3" works in jstester-3, on aggregor/jstester-3.
const createSessionWorktree = Effect.fn("SessionService.createSessionWorktree")(function* (
  worktreeDraft: SessionWorktreeDraft,
  chosenBaseBranchName: string | undefined
) {
  const worktreeInfraService = yield* IWorktreeInfraService;
  const worktreeName = yield* getWorktreeName(worktreeDraft.sessionName);
  // Without a chosen branch the worktree starts from the project's HEAD, so the branch checked out there is its base.
  const baseBranchNameResult =
    chosenBaseBranchName === undefined
      ? yield* Effect.result(worktreeInfraService.readBranchName(worktreeDraft.project.path))
      : Result.succeed(chosenBaseBranchName);
  const sessionWorktree = yield* worktreeInfraService.createWorktree({
    branchName: yield* getWorktreeBranchName(worktreeName),
    projectPath: worktreeDraft.project.path,
    startPoint: chosenBaseBranchName === undefined ? GIT_COMMAND.HEAD_START_POINT : chosenBaseBranchName,
    worktreeName,
    worktreesFolderName: yield* getWorktreesFolderName(worktreeDraft.projectName, worktreeDraft.project.id),
    worktreesFolderPath: worktreeDraft.project.settings.worktreeFolder
  });
  yield* worktreeInfraService.copyIncludedFiles({
    filePatterns: worktreeDraft.project.settings.filesToCopy,
    projectPath: worktreeDraft.project.path,
    worktreePath: sessionWorktree.worktreePath
  });

  const sessionWorkingTree: SessionWorkingTree = {
    baseBranchName: Result.getOrUndefined(baseBranchNameResult),
    setupScript: worktreeDraft.project.settings.setupScript,
    worktreePath: sessionWorktree.worktreePath
  };

  return sessionWorkingTree;
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
  worktreeDraft: SessionWorktreeDraft,
  workingTreeChoice: WorkingTreeChoiceDto
) {
  return yield* Match.valueTags(workingTreeChoice, {
    [WORKING_TREE_CHOICE_TAGS.EXISTING_WORKTREE]: (existingWorktree) =>
      Effect.map(findExistingWorktree(worktreeDraft.project.path, existingWorktree.worktreePath), (worktreePath) => ({
        baseBranchName: undefined,
        setupScript: undefined,
        worktreePath
      })),
    [WORKING_TREE_CHOICE_TAGS.NEW_WORKTREE]: (newWorktree) =>
      createSessionWorktree(worktreeDraft, newWorktree.baseBranchName),
    [WORKING_TREE_CHOICE_TAGS.PROJECT_ROOT]: () =>
      Effect.succeed({baseBranchName: undefined, setupScript: undefined, worktreePath: undefined})
  });
});

const findSessionAgent = Effect.fn("SessionService.findSessionAgent")(function* (session: SessionEntity) {
  return yield* IAgentRepository.use((agentRepository) => agentRepository.findById(session.agentId));
});

// Closing a tab only detaches it from its agent, which keeps running.
const closeOtherSessionTabs = Effect.fn("SessionService.closeOtherSessionTabs")(function* (
  shownSessionId: EntityIdValueObject
) {
  const sessionSettings = yield* ISettingsConfig.use((settingsConfig) => settingsConfig.readSessionSettings);
  if (sessionSettings.openSessionIn !== SESSION_OPEN_PLACES.SHARED_TAB) return;

  yield* ITerminalInfraService.use((terminalInfraService) =>
    terminalInfraService.closeOtherSessionTerminals(shownSessionId)
  );
});

const openSessionTab = Effect.fn("SessionService.openSessionTab")(function* (
  session: SessionEntity,
  setupScript: string | undefined
) {
  const tmuxInfraService = yield* ITmuxInfraService;
  const sessionAgent = yield* findSessionAgent(session);
  const launchPlan = yield* prepareLaunchPlan(sessionAgent, session);
  const sessionSettings = yield* ISettingsConfig.use((settingsConfig) => settingsConfig.readSessionSettings);
  const tabCommand = yield* tmuxInfraService.prepareSessionTabCommand({
    launchPlan,
    sessionId: session.id,
    sessionMemoryLimit: sessionSettings.sessionMemoryLimit,
    setupScript,
    workingFolderPath: session.workingFolderPath
  });
  const sessionTabRequest: SessionTabRequest = {
    icon: sessionAgent.icon,
    isPinned: sessionSettings.pinSessionTabs,
    isShared: sessionSettings.openSessionIn === SESSION_OPEN_PLACES.SHARED_TAB,
    tabCommand,
    tabName: session.displayName
  };

  yield* ITerminalInfraService.use((terminalInfraService) =>
    terminalInfraService.openSessionTerminal(session, sessionTabRequest)
  );
  yield* closeOtherSessionTabs(session.id);
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

// The extension can restart under open tabs, each showing the session tmux last attached it to.
export const syncSessionTabsWithTmux = Effect.fn("SessionService.syncSessionTabsWithTmux")(function* () {
  const shownSessionIdsByTabProcessId = yield* ITmuxInfraService.use(
    (tmuxInfraService) => tmuxInfraService.readShownSessionIdsByTabProcessId
  );

  yield* ITerminalInfraService.use((terminalInfraService) =>
    terminalInfraService.assignShownSessions(shownSessionIdsByTabProcessId)
  );
});

// tmux attaches the open tab to the session, so no tab opens or closes; an agent that has stopped needs a new tab.
const showSessionInSharedTab = Effect.fn("SessionService.showSessionInSharedTab")(
  function* (session: SessionEntity) {
    const terminalInfraService = yield* ITerminalInfraService;
    const sharedTabProcessId = yield* terminalInfraService.findOpenSessionTerminalProcessId;
    yield* ITmuxInfraService.use((tmuxInfraService) =>
      tmuxInfraService.showSessionInTab(sharedTabProcessId, session.id)
    );
    yield* syncSessionTabsWithTmux();
    yield* terminalInfraService.focusSessionTerminal(session.id);
    yield* terminalInfraService.nameActiveSessionTab(session.id, session.displayName);
    yield* terminalInfraService.closeOtherSessionTerminals(session.id);
  },
  (effect, session) =>
    Effect.catchTag(effect, ["NoSessionTabOpenError", "SessionTabSwitchFailedError", "TerminalNotFoundError"], () =>
      openSessionTab(session, undefined)
    )
);

const reopenSession = Effect.fn("SessionService.reopenSession")(function* (sessionId: EntityIdValueObject) {
  const session = yield* findSession(sessionId);
  const sessionSettings = yield* ISettingsConfig.use((settingsConfig) => settingsConfig.readSessionSettings);

  return yield* sessionSettings.openSessionIn === SESSION_OPEN_PLACES.SHARED_TAB
    ? showSessionInSharedTab(session)
    : openSessionTab(session, undefined);
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

const findSessionStatus = Effect.fn("SessionService.findSessionStatus")(function* (session: SessionEntity) {
  const terminalInfraService = yield* ITerminalInfraService;
  const tmuxInfraService = yield* ITmuxInfraService;
  const runningSessionIds = yield* SubscriptionRef.get(tmuxInfraService.runningSessionIds);
  const viewedSessionIdResult = yield* SubscriptionRef.get(terminalInfraService.viewedSessionId);
  const isAgentRunning = runningSessionIds.has(session.id);
  const isInView = Result.getOrUndefined(viewedSessionIdResult) === session.id;

  return {isAgentRunning, status: yield* getSessionStatus(session, {isAgentRunning, isInView})};
});

const isAgentRunningIdle = Effect.fn("SessionService.isAgentRunningIdle")(function* (session: SessionEntity) {
  const sessionStatus = yield* findSessionStatus(session);

  return sessionStatus.isAgentRunning && !(yield* isSessionTurnRunning(sessionStatus.status));
});

// An agent mid-turn runs on in tmux and finishes its turn; an idle one stops; every tab closes.
const archiveSessions = Effect.fn("SessionService.archiveSessions")(function* (sessions: readonly SessionEntity[]) {
  const sessionIds = Array.map(sessions, (session) => session.id);
  const idleAgentSessions = yield* Effect.filter(sessions, (session) => isAgentRunningIdle(session));
  yield* moveSessionsToLifecycle(sessionIds, SESSION_LIFECYCLES.ARCHIVED);
  yield* Effect.forEach(idleAgentSessions, (idleAgentSession) => stopAgentAndCloseTab(idleAgentSession.id));
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
    const addedSession = yield* addSession(newSessionDraft, sessionWorkingTree);

    yield* launchNewSession(addedSession, sessionWorkingTree.setupScript);
  },
  Effect.catchTag("ProjectNotListedError", () => Effect.void)
);

export const openSession = Effect.fn("SessionService.openSession")(
  function* (request: OpenSessionRequestDto) {
    yield* ITerminalInfraService.use((terminalInfraService) =>
      terminalInfraService.focusSessionTerminal(request.sessionId)
    );
    yield* closeOtherSessionTabs(request.sessionId);
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

    yield* archiveSessions([session]);
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

const isCurrentWorkingTree = Effect.fn("SessionService.isCurrentWorkingTree")(function* (
  session: SessionEntity,
  workingTreeChoice: WorkingTreeChoiceDto
) {
  return Match.valueTags(workingTreeChoice, {
    [WORKING_TREE_CHOICE_TAGS.EXISTING_WORKTREE]: (existingWorktree) =>
      existingWorktree.worktreePath === session.worktreePath,
    [WORKING_TREE_CHOICE_TAGS.NEW_WORKTREE]: () => false,
    [WORKING_TREE_CHOICE_TAGS.PROJECT_ROOT]: () => session.worktreePath === undefined
  });
});

const findSessionWorktreeDraft = Effect.fn("SessionService.findSessionWorktreeDraft")(function* (
  session: SessionEntity
) {
  const sessionProject = yield* findProjectListItem(session.projectPath);
  const worktreeDraft: SessionWorktreeDraft = {
    project: yield* findEntityById(IProjectRepository, session.projectId),
    projectName: sessionProject.name,
    sessionName: session.name
  };

  return worktreeDraft;
});

// A running agent starts again in the new folder and resumes its conversation there; a new worktree's setup script runs.
export const changeSessionWorkingTree = Effect.fn("SessionService.changeSessionWorkingTree")(
  function* (request: ChangeSessionWorkingTreeRequestDto) {
    const session = yield* findSession(request.sessionId);
    if (yield* isCurrentWorkingTree(session, request.workingTree)) return;
    const worktreeDraft = yield* findSessionWorktreeDraft(session);
    const sessionWorkingTree = yield* prepareSessionWorkingTree(worktreeDraft, request.workingTree);
    const runningSessionIds = yield* ITmuxInfraService.use(
      (tmuxInfraService) => tmuxInfraService.refreshRunningSessionIds
    );
    const isAgentRunning = runningSessionIds.has(session.id);
    yield* Effect.annotateCurrentSpan({isAgentRunning, worktreePath: sessionWorkingTree.worktreePath});
    if (isAgentRunning) yield* stopAgentAndCloseTab(session.id);
    yield* updateEntity(ISessionRepository, session.id, {
      baseBranchName: sessionWorkingTree.baseBranchName,
      worktreePath: sessionWorkingTree.worktreePath
    });
    // The worktree left behind may be a leftover now, and only a project's draw reads its leftovers.
    yield* updateEntity(IProjectRepository, session.projectId, {});
    if (!isAgentRunning && sessionWorkingTree.setupScript === undefined) return;

    const movedSession = yield* findSession(session.id);
    yield* openSessionTab(movedSession, sessionWorkingTree.setupScript);
  },
  Effect.catchTags({EntityNotFoundError: () => Effect.void, ProjectNotListedError: () => Effect.void})
);

// The session goes back to its project's root; the worktree stays, a leftover if Aggregor made it.
export const unlinkSessionWorktree = Effect.fn("SessionService.unlinkSessionWorktree")(function* (
  request: UnlinkSessionWorktreeRequestDto
) {
  yield* changeSessionWorkingTree({
    sessionId: request.sessionId,
    workingTree: WorkingTreeChoiceDtoSchema.cases[WORKING_TREE_CHOICE_TAGS.PROJECT_ROOT].make({})
  });
});

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

// Sessions are listed newest first, the reverse of their sortId order, so moving up places one after the next.
export const moveSessionUp = Effect.fn("SessionService.moveSessionUp")(
  function* (request: MoveSessionUpRequestDto) {
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

export const moveSessionDown = Effect.fn("SessionService.moveSessionDown")(
  function* (request: MoveSessionDownRequestDto) {
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

// In the order the list shows, newest first.
const findSessionMoves = Effect.fn("SessionService.findSessionMoves")(function* (
  session: SessionEntity,
  storedSessions: readonly SessionEntity[]
) {
  const projectSessions = Array.filter(
    storedSessions,
    (storedSession) => storedSession.projectId === session.projectId && storedSession.lifecycle === session.lifecycle
  );
  const listedSessionIds = Array.reverse(Array.map(projectSessions, (projectSession) => projectSession.id));
  const sessionMoves: SessionMoves = {
    canMoveDown: yield* canMoveDownInOrder(listedSessionIds, session.id),
    canMoveUp: yield* canMoveUpInOrder(listedSessionIds, session.id)
  };

  return sessionMoves;
});

// A session from before baseBranchName was stored, or in a worktree Aggregor didn't make, counts from the project's branch.
const readSessionDiffStats = Effect.fn("SessionService.readSessionDiffStats")(function* (
  session: SessionEntity,
  worktreePath: ProjectPathValueObject
) {
  const baseBranchName =
    session.baseBranchName === undefined
      ? yield* IWorktreeInfraService.use((worktreeInfraService) =>
          worktreeInfraService.readBranchName(session.projectPath)
        )
      : session.baseBranchName;

  return yield* IWorktreeInfraService.use((worktreeInfraService) =>
    worktreeInfraService.readDiffStats(worktreePath, baseBranchName)
  );
});

// A linked pull request, else the one whose head is the worktree's branch; the root's branch is every root session's.
export const findSessionPullRequestLookup = Effect.fn("SessionService.findSessionPullRequestLookup")(function* (
  session: SessionEntity
) {
  if (session.pullRequestNumber !== undefined) {
    const linkedPullRequestLookup: PullRequestLookup = {
      folderPath: session.workingFolderPath,
      pullRequestReference: `${session.pullRequestNumber}`
    };

    return linkedPullRequestLookup;
  }
  const worktreePath = session.worktreePath;
  if (worktreePath === undefined) return yield* SessionNotInWorktreeError.make();
  const branchPullRequestLookup: PullRequestLookup = {
    folderPath: worktreePath,
    pullRequestReference: yield* IWorktreeInfraService.use((worktreeInfraService) =>
      worktreeInfraService.readBranchName(worktreePath)
    )
  };

  return branchPullRequestLookup;
});

// gh's answer from the last lookup; the first sight of a pull request starts one, and its result redraws the row.
const findSessionPullRequestFields = Effect.fn("SessionService.findSessionPullRequestFields")(function* (
  session: SessionEntity
) {
  const pullRequestLookupResult = yield* Effect.result(findSessionPullRequestLookup(session));
  if (Result.isFailure(pullRequestLookupResult)) return {};
  const pullRequestResult = yield* Effect.result(
    IGitHubCliInfraService.use((gitHubCliInfraService) =>
      gitHubCliInfraService.findPullRequest(pullRequestLookupResult.success)
    )
  );

  return Result.match(pullRequestResult, {
    onFailure: () => ({}),
    onSuccess: (pullRequest) => ({
      pullRequest: SessionPullRequestDtoSchema.make({
        number: pullRequest.number,
        state: pullRequest.state,
        title: pullRequest.title
      })
    })
  });
});

const findSessionWorktreeFields = Effect.fn("SessionService.findSessionWorktreeFields")(function* (
  session: SessionEntity
) {
  const worktreePath = session.worktreePath;
  if (worktreePath === undefined) return {};
  const branchNameResult = yield* Effect.result(
    IWorktreeInfraService.use((worktreeInfraService) => worktreeInfraService.readBranchName(worktreePath))
  );
  const diffStatsResult = yield* Effect.result(readSessionDiffStats(session, worktreePath));

  return {
    ...Result.match(diffStatsResult, {onFailure: () => ({}), onSuccess: (diffStats) => ({diffStats})}),
    ...Result.match(branchNameResult, {onFailure: () => ({}), onSuccess: (branchName) => ({branchName})})
  };
});

const findAgentConversationIdField = Effect.fn("SessionService.findAgentConversationIdField")(function* (
  sessionAgent: AgentEntity,
  session: SessionEntity
) {
  const agentConversationIdResult = yield* Effect.result(getAgentConversationId(sessionAgent, session));

  return Result.match(agentConversationIdResult, {
    onFailure: () => ({}),
    onSuccess: (agentConversationId) => ({agentConversationId})
  });
});

const findSessionAgentFields = Effect.fn("SessionService.findSessionAgentFields")(function* (session: SessionEntity) {
  const agentResult = yield* Effect.result(findSessionAgent(session));
  if (Result.isFailure(agentResult)) return {};
  const sessionAgent = agentResult.success;

  return {
    ...(yield* findAgentConversationIdField(sessionAgent, session)),
    agentName: sessionAgent.name,
    icon: sessionAgent.icon
  };
});

const isStoredSessionWaitingOnUser = Effect.fn("SessionService.isStoredSessionWaitingOnUser")(function* (
  storedSession: SessionEntity
) {
  const sessionStatus = yield* findSessionStatus(storedSession);

  return yield* isSessionWaitingOnUser(sessionStatus.status);
});

const toSessionTask = Effect.fn("SessionService.toSessionTask")(function* (agentTask: AgentTaskValueObject) {
  return SessionTaskDtoSchema.make({
    displayName: agentTask.title === undefined ? agentTask.taskId : agentTask.title,
    kind: yield* getAgentTaskKind(agentTask.taskId),
    state: agentTask.state,
    statusMessage: agentTask.message,
    statusProgress: agentTask.progress,
    taskId: agentTask.taskId
  });
});

const toSessionListItem = Effect.fn("SessionService.toSessionListItem")(function* (
  session: SessionEntity,
  sessionMoves: SessionMoves
) {
  const path = yield* Path;
  const sessionStatus = yield* findSessionStatus(session);
  const status = sessionStatus.status;
  const isTurnRunning = yield* isSessionTurnRunning(status);
  const sessionTasks = yield* getSessionTasks(session);

  return SessionListItemDtoSchema.make({
    ...sessionMoves,
    ...(yield* findSessionAgentFields(session)),
    ...(yield* findSessionWorktreeFields(session)),
    ...(yield* findSessionPullRequestFields(session)),
    displayName: session.displayName,
    isAgentRunning: sessionStatus.isAgentRunning,
    isArchived: session.lifecycle === SESSION_LIFECYCLES.ARCHIVED,
    isPullRequestLinked: session.pullRequestNumber !== undefined,
    name: session.name,
    projectName: path.basename(session.projectPath),
    projectPath: session.projectPath,
    sessionId: session.id,
    status,
    statusKind: status === SESSION_STATUSES.BLOCKED ? session.statusKind : undefined,
    statusMessage: sessionStatus.isAgentRunning ? session.statusMessage : undefined,
    statusProgress: isTurnRunning ? session.statusProgress : undefined,
    tasks: sessionStatus.isAgentRunning ? yield* Effect.forEach(sessionTasks, toSessionTask) : [],
    worktreePath: session.worktreePath
  });
});

export const getSessionListItem = Effect.fn("SessionService.getSessionListItem")(function* (
  request: GetSessionListItemRequestDto
) {
  const session = yield* findSession(request.sessionId);
  const projectSessions = yield* findEntities(ISessionRepository, {projectId: session.projectId});

  const sessionMoves = yield* findSessionMoves(session, projectSessions);

  return yield* toSessionListItem(session, sessionMoves);
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

const loadSessionPages = Effect.fn("SessionService.loadSessionPages")(function* (
  sessionListFilter: SessionListFilter,
  shownPageCount: number
) {
  let sessionPage = yield* findEntityPage(ISessionRepository, sessionListFilter, {pageSize: SESSION_PAGES.PAGE_SIZE});
  for (let pageNumber = 1; pageNumber < shownPageCount; pageNumber += 1) {
    const nextCursor = sessionPage.pagination.nextCursor;
    if (nextCursor === undefined) break;
    const nextPage = yield* findEntityPage(ISessionRepository, sessionListFilter, {
      afterCursor: nextCursor,
      pageSize: SESSION_PAGES.PAGE_SIZE
    });
    sessionPage = {entities: [...sessionPage.entities, ...nextPage.entities], pagination: nextPage.pagination};
  }

  return sessionPage;
});

const countHiddenWaitingSessions = Effect.fn("SessionService.countHiddenWaitingSessions")(function* (
  sessionListFilter: SessionListFilter,
  shownSessions: readonly SessionEntity[]
) {
  const shownSessionIds = new Set(Array.map(shownSessions, (shownSession) => shownSession.id));
  const listSessions = yield* findEntities(ISessionRepository, sessionListFilter);
  const hiddenSessions = Array.filter(listSessions, (listSession) => !shownSessionIds.has(listSession.id));
  const hiddenWaitingSessions = yield* Effect.filter(hiddenSessions, isStoredSessionWaitingOnUser);

  return hiddenWaitingSessions.length;
});

// The pages shown always start at the newest, so a row's place among them is its place in the whole list.
const toPagedSessionListItems = Effect.fn("SessionService.toPagedSessionListItems")(function* (
  sessionPage: EntityPage<SessionEntity>
) {
  return yield* Effect.forEach(sessionPage.entities, (shownSession, shownIndex) =>
    toSessionListItem(shownSession, {
      canMoveDown: shownIndex < sessionPage.entities.length - 1 || sessionPage.pagination.hasNextPage,
      canMoveUp: shownIndex > 0
    })
  );
});

const findSessionListFilter = Effect.fn("SessionService.findSessionListFilter")(function* (
  projectPath: ProjectPathValueObject,
  lifecycle: SessionLifecycleValueObject
) {
  const [storedProject] = yield* findEntities(IProjectRepository, {path: projectPath});
  if (storedProject === undefined) return yield* ProjectNotStoredError.make();
  const sessionListFilter: SessionListFilter = {lifecycle, projectId: storedProject.id};

  return sessionListFilter;
});

// A project never stored has no sessions yet.
const findProjectSessionPage = Effect.fn("SessionService.findProjectSessionPage")(
  function* (projectPath: ProjectPathValueObject, lifecycle: SessionLifecycleValueObject, shownPageCount: number) {
    const sessionListFilter = yield* findSessionListFilter(projectPath, lifecycle);
    const sessionPage = yield* loadSessionPages(sessionListFilter, shownPageCount);
    const hiddenWaitingCount = yield* countHiddenWaitingSessions(sessionListFilter, sessionPage.entities);

    return {
      sessionListItems: yield* toPagedSessionListItems(sessionPage),
      sessionPage: SessionPageDtoSchema.make({
        hiddenSessionCount: sessionPage.pagination.remainingCount,
        hiddenWaitingCount,
        totalSessionCount: sessionPage.pagination.totalCount
      })
    };
  },
  Effect.catchTag("ProjectNotStoredError", () =>
    Effect.succeed({
      sessionListItems: [],
      sessionPage: SessionPageDtoSchema.make({hiddenSessionCount: 0, hiddenWaitingCount: 0, totalSessionCount: 0})
    })
  )
);

const toProjectSessions = Effect.fn("SessionService.toProjectSessions")(function* (
  projectListItem: ProjectListItemDto,
  lifecycle: SessionLifecycleValueObject,
  shownPageCount: number
) {
  const projectSessionPage = yield* findProjectSessionPage(projectListItem.path, lifecycle, shownPageCount);

  return ProjectSessionsDtoSchema.make({
    ...(yield* findProjectWorktrees(projectListItem, lifecycle)),
    projectListItem,
    sessionListItems: projectSessionPage.sessionListItems,
    sessionPage: projectSessionPage.sessionPage
  });
});

const findShownPageCount = Effect.fn("SessionService.findShownPageCount")(function* (
  request: ListProjectSessionsRequestDto,
  projectPath: ProjectPathValueObject
) {
  const shownPageCount = request.shownPageCounts[projectPath];

  return shownPageCount === undefined ? SESSION_PAGES.FIRST_PAGE_COUNT : shownPageCount;
});

const listProjectsWithLifecycleSessions = Effect.fn("SessionService.listProjectsWithLifecycleSessions")(function* (
  lifecycle: SessionLifecycleValueObject,
  request: ListProjectSessionsRequestDto
) {
  const projectListItems = yield* listProjects();

  return yield* Effect.forEach(projectListItems, (projectListItem) =>
    Effect.flatMap(findShownPageCount(request, projectListItem.path), (shownPageCount) =>
      toProjectSessions(projectListItem, lifecycle, shownPageCount)
    )
  );
});

// A project no longer listed draws nothing: the change that unlisted it redraws every project.
export const getProjectSessions = Effect.fn("SessionService.getProjectSessions")(function* (
  request: GetProjectSessionsRequestDto
) {
  const projectListItem = yield* findProjectListItem(request.projectPath);

  return yield* toProjectSessions(projectListItem, SESSION_LIFECYCLES.ONGOING, request.shownPageCount);
});

export const listProjectsWithSessions = Effect.fn("SessionService.listProjectsWithSessions")(function* (
  request: ListProjectSessionsRequestDto
) {
  return yield* listProjectsWithLifecycleSessions(SESSION_LIFECYCLES.ONGOING, request);
});

// A project no longer listed hides its archived sessions, as it does its others.
export const listProjectsWithArchivedSessions = Effect.fn("SessionService.listProjectsWithArchivedSessions")(function* (
  request: ListProjectSessionsRequestDto
) {
  const projectsWithArchivedSessions = yield* listProjectsWithLifecycleSessions(SESSION_LIFECYCLES.ARCHIVED, request);

  return Array.filter(
    projectsWithArchivedSessions,
    (projectWithArchivedSessions) => projectWithArchivedSessions.sessionPage.totalSessionCount > 0
  );
});

export const archiveProjectSessions = Effect.fn("SessionService.archiveProjectSessions")(
  function* (request: ArchiveProjectSessionsRequestDto) {
    const projectSessions = yield* findProjectSessions(request.projectPath, SESSION_LIFECYCLES.ONGOING);
    yield* archiveSessions(projectSessions);
  },
  Effect.catchTag("EntityNotFoundError", () => Effect.void)
);

export const archiveOngoingSessions = Effect.fn("SessionService.archiveOngoingSessions")(
  function* () {
    const listedSessions = yield* findListedSessions(SESSION_LIFECYCLES.ONGOING);
    yield* archiveSessions(listedSessions);
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

// Only the sessions waiting become list items, so a redraw of the counts reads no worktree's git state.
export const listSessionsWaitingOnUser = Effect.fn("SessionService.listSessionsWaitingOnUser")(function* () {
  const storedSessions = yield* findEntities(ISessionRepository, {});
  const waitingSessions = yield* Effect.filter(storedSessions, isStoredSessionWaitingOnUser);

  return yield* Effect.forEach(waitingSessions, (waitingSession) =>
    Effect.flatMap(findSessionMoves(waitingSession, storedSessions), (sessionMoves) =>
      toSessionListItem(waitingSession, sessionMoves)
    )
  );
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

// The rows of the sessions working in the folder whose pull request changed; a failed read redraws none.
const toPullRequestChanges = Effect.fn("SessionService.toPullRequestChanges")(
  function* (folderPath: ProjectPathValueObject) {
    const sessions = yield* findEntities(ISessionRepository, {});
    const folderSessions = Array.filter(sessions, (session) => session.workingFolderPath === folderPath);

    return Array.map(folderSessions, (folderSession) =>
      SessionListChangeDtoSchema.cases.SessionChanged.make({sessionId: folderSession.id})
    );
  },
  Effect.catch((databaseError) => Effect.as(Effect.logWarning("Could not find the rows to redraw", databaseError), []))
);

// Coming into or leaving view writes viewedAt, so it arrives as a write.
export const watchSessionListChanges = Effect.fn("SessionService.watchSessionListChanges")(function* () {
  const gitHubCliInfraService = yield* IGitHubCliInfraService;
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
    ),
    Stream.flatMap(gitHubCliInfraService.pullRequestChangedFolderPaths, (folderPath) =>
      Stream.fromIterableEffect(
        Effect.provideService(toPullRequestChanges(folderPath), ISessionRepository, sessionRepository)
      )
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

const markSessionsRunning = Effect.fn("SessionService.markSessionsRunning")(
  function* (runningSessionIds: ReadonlySet<EntityIdValueObject>) {
    const storedSessions = yield* findEntities(ISessionRepository, {});
    const newlyRunningSessions = Array.filter(
      storedSessions,
      (storedSession) =>
        runningSessionIds.has(storedSession.id) && storedSession.runState !== SESSION_RUN_STATES.RUNNING
    );

    yield* Effect.forEach(newlyRunningSessions, (newlyRunningSession) =>
      updateEntity(ISessionRepository, newlyRunningSession.id, {runState: SESSION_RUN_STATES.RUNNING})
    );
  },
  Effect.catch((databaseError) => Effect.logWarning("Could not mark the running sessions", databaseError))
);

const clearStoppedRunStates = Effect.fn("SessionService.clearStoppedRunStates")(
  function* () {
    const tmuxInfraService = yield* ITmuxInfraService;
    const runningSessionIds = yield* SubscriptionRef.get(tmuxInfraService.runningSessionIds);
    const sessionsSeenRunning = yield* findEntities(ISessionRepository, {runState: SESSION_RUN_STATES.RUNNING});
    const stoppedSessions = Array.filter(
      sessionsSeenRunning,
      (sessionSeenRunning) => !runningSessionIds.has(sessionSeenRunning.id)
    );

    yield* Effect.forEach(stoppedSessions, (stoppedSession) =>
      updateEntity(ISessionRepository, stoppedSession.id, {runState: undefined})
    );
  },
  Effect.catch((databaseError) => Effect.logWarning("Could not clear the stopped sessions' marks", databaseError))
);

// With no agent running as the window starts, the tmux server went away with them, as when the computer restarts.
const markInterruptedSessions = Effect.fn("SessionService.markInterruptedSessions")(
  function* (runningSessionIds: ReadonlySet<EntityIdValueObject>) {
    if (runningSessionIds.size > 0) return;
    const sessionsSeenRunning = yield* findEntities(ISessionRepository, {runState: SESSION_RUN_STATES.RUNNING});

    yield* Effect.forEach(sessionsSeenRunning, (sessionSeenRunning) =>
      updateEntity(ISessionRepository, sessionSeenRunning.id, {runState: SESSION_RUN_STATES.INTERRUPTED})
    );
  },
  Effect.catch((databaseError) => Effect.logWarning("Could not mark the interrupted sessions", databaseError))
);

// aggregor-pty writes exited however its agent ends, a shutdown included, so the mark comes from what tmux runs.
export const startRunStateSync = Effect.fn("SessionService.startRunStateSync")(function* () {
  const tmuxInfraService = yield* ITmuxInfraService;
  const runningSessionIdChanges = SubscriptionRef.changes(tmuxInfraService.runningSessionIds);
  const startRunningSessionIds = yield* SubscriptionRef.get(tmuxInfraService.runningSessionIds);
  yield* markInterruptedSessions(startRunningSessionIds);

  yield* Effect.forkScoped(Stream.runForEach(runningSessionIdChanges, markSessionsRunning));
  yield* Effect.forkScoped(
    Stream.runForEach(Stream.debounce(runningSessionIdChanges, SESSION_RUN_STATE.STOP_SETTLE_INTERVAL), () =>
      clearStoppedRunStates()
    )
  );
});

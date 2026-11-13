import {
  ArchiveProjectSessionsRequestDtoSchema,
  ArchiveSessionRequestDtoSchema,
  GetSessionListItemRequestDtoSchema,
  ListArchivedProjectSessionIdsRequestDtoSchema,
  ListProjectSessionIdsRequestDtoSchema,
  MoveSessionDownRequestDtoSchema,
  MoveSessionToPlaceOfRequestDtoSchema,
  MoveSessionUpRequestDtoSchema,
  NewSessionRequestDtoSchema,
  OpenSessionRequestDtoSchema,
  RemoveSessionRequestDtoSchema,
  RenameSessionRequestDtoSchema,
  StopArchivedProjectSessionAgentsRequestDtoSchema,
  StopProjectSessionAgentsRequestDtoSchema,
  StopSessionAgentRequestDtoSchema,
  UnarchiveSessionRequestDtoSchema
} from "@dtos/session.dto.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {decodeProjectNodeRequest, decodeSessionNodeRequest} from "@presentationUtils/sessionsTreeNode.utils.ts";
import {
  archiveOngoingSessions,
  archiveProjectSessions,
  archiveSession,
  findViewedSessionId,
  getSessionListItem,
  listArchivedProjectSessionIds,
  listProjectSessionIds,
  listProjectsWithArchivedSessions,
  listSessionsWaitingOnUser,
  moveSessionDown,
  moveSessionToPlaceOf,
  moveSessionUp,
  newSession,
  openSession,
  removeSession,
  renameSession,
  stopArchivedProjectSessionAgents,
  stopArchivedSessionAgents,
  stopOngoingSessionAgents,
  stopProjectSessionAgents,
  stopSessionAgent,
  unarchiveSession,
  watchSessionListChanges,
  watchViewedSessionIds
} from "@services/session.service.ts";
import {Effect} from "effect";

export const newSessionInChosenProject = Effect.fn("SessionController.newSessionInChosenProject")(function* (
  projectNodeId: unknown
) {
  const request = yield* decodeProjectNodeRequest(NewSessionRequestDtoSchema, projectNodeId);
  yield* newSession(request);
});

// VS Code passes title-bar buttons the focused row, which can be any row, so its arguments are dropped.
export const newSessionAskingForProject = Effect.fn("SessionController.newSessionAskingForProject")(function* () {
  const request = yield* decodeVsCodeArgument(NewSessionRequestDtoSchema, {});
  yield* newSession(request);
});

export const openChosenSession = Effect.fn("SessionController.openChosenSession")(function* (sessionNodeId: unknown) {
  const request = yield* decodeSessionNodeRequest(OpenSessionRequestDtoSchema, sessionNodeId);
  yield* openSession(request);
});

export const removeChosenSession = Effect.fn("SessionController.removeChosenSession")(function* (
  sessionNodeId: unknown
) {
  const request = yield* decodeSessionNodeRequest(RemoveSessionRequestDtoSchema, sessionNodeId);
  yield* removeSession(request);
});

export const archiveChosenSession = Effect.fn("SessionController.archiveChosenSession")(function* (
  sessionNodeId: unknown
) {
  const request = yield* decodeSessionNodeRequest(ArchiveSessionRequestDtoSchema, sessionNodeId);
  yield* archiveSession(request);
});

export const unarchiveChosenSession = Effect.fn("SessionController.unarchiveChosenSession")(function* (
  sessionNodeId: unknown
) {
  const request = yield* decodeSessionNodeRequest(UnarchiveSessionRequestDtoSchema, sessionNodeId);
  yield* unarchiveSession(request);
});

export const stopChosenSessionAgent = Effect.fn("SessionController.stopChosenSessionAgent")(function* (
  sessionNodeId: unknown
) {
  const request = yield* decodeSessionNodeRequest(StopSessionAgentRequestDtoSchema, sessionNodeId);
  yield* stopSessionAgent(request);
});

export const stopChosenProjectSessionAgents = Effect.fn("SessionController.stopChosenProjectSessionAgents")(function* (
  projectNodeId: unknown
) {
  const request = yield* decodeProjectNodeRequest(StopProjectSessionAgentsRequestDtoSchema, projectNodeId);
  yield* stopProjectSessionAgents(request);
});

export const stopChosenArchivedProjectSessionAgents = Effect.fn(
  "SessionController.stopChosenArchivedProjectSessionAgents"
)(function* (projectNodeId: unknown) {
  const request = yield* decodeProjectNodeRequest(StopArchivedProjectSessionAgentsRequestDtoSchema, projectNodeId);
  yield* stopArchivedProjectSessionAgents(request);
});

export const archiveChosenProjectSessions = Effect.fn("SessionController.archiveChosenProjectSessions")(function* (
  projectNodeId: unknown
) {
  const request = yield* decodeProjectNodeRequest(ArchiveProjectSessionsRequestDtoSchema, projectNodeId);
  yield* archiveProjectSessions(request);
});

export const archiveAllOngoingSessions = Effect.fn("SessionController.archiveAllOngoingSessions")(function* () {
  yield* archiveOngoingSessions();
});

export const stopAllOngoingSessionAgents = Effect.fn("SessionController.stopAllOngoingSessionAgents")(function* () {
  yield* stopOngoingSessionAgents();
});

export const stopAllArchivedSessionAgents = Effect.fn("SessionController.stopAllArchivedSessionAgents")(function* () {
  yield* stopArchivedSessionAgents();
});

export const renameChosenSession = Effect.fn("SessionController.renameChosenSession")(function* (
  sessionNodeId: unknown
) {
  const request = yield* decodeSessionNodeRequest(RenameSessionRequestDtoSchema, sessionNodeId);
  yield* renameSession(request);
});

export const moveChosenSessionUp = Effect.fn("SessionController.moveChosenSessionUp")(function* (
  sessionNodeId: unknown
) {
  const request = yield* decodeSessionNodeRequest(MoveSessionUpRequestDtoSchema, sessionNodeId);
  yield* moveSessionUp(request);
});

export const moveChosenSessionDown = Effect.fn("SessionController.moveChosenSessionDown")(function* (
  sessionNodeId: unknown
) {
  const request = yield* decodeSessionNodeRequest(MoveSessionDownRequestDtoSchema, sessionNodeId);
  yield* moveSessionDown(request);
});

export const moveSessionToPlaceOfForSessionsView = Effect.fn("SessionController.moveSessionToPlaceOfForSessionsView")(
  function* (sessionId: string, placeOfSessionId: string) {
    const request = yield* decodeVsCodeArgument(MoveSessionToPlaceOfRequestDtoSchema, {placeOfSessionId, sessionId});
    yield* moveSessionToPlaceOf(request);
  }
);

export const getSessionListItemForSessionsView = Effect.fn("SessionController.getSessionListItemForSessionsView")(
  function* (sessionId: string) {
    const request = yield* decodeVsCodeArgument(GetSessionListItemRequestDtoSchema, {sessionId});

    return yield* getSessionListItem(request);
  }
);

export const listProjectSessionIdsForSessionsView = Effect.fn("SessionController.listProjectSessionIdsForSessionsView")(
  function* (projectPath: string) {
    const request = yield* decodeVsCodeArgument(ListProjectSessionIdsRequestDtoSchema, {projectPath});

    return yield* listProjectSessionIds(request);
  }
);

export const listSessionsWaitingOnUserForSessionsView = Effect.fn(
  "SessionController.listSessionsWaitingOnUserForSessionsView"
)(function* () {
  return yield* listSessionsWaitingOnUser();
});

export const watchSessionListChangesForSessionsView = Effect.fn(
  "SessionController.watchSessionListChangesForSessionsView"
)(function* () {
  return yield* watchSessionListChanges();
});

export const watchViewedSessionIdsForSessionsView = Effect.fn("SessionController.watchViewedSessionIdsForSessionsView")(
  function* () {
    return yield* watchViewedSessionIds();
  }
);

export const findViewedSessionIdForSessionsView = Effect.fn("SessionController.findViewedSessionIdForSessionsView")(
  function* () {
    return yield* findViewedSessionId();
  }
);

export const listArchivedProjectsForSessionsView = Effect.fn("SessionController.listArchivedProjectsForSessionsView")(
  function* () {
    return yield* listProjectsWithArchivedSessions();
  }
);

export const listArchivedProjectSessionIdsForSessionsView = Effect.fn(
  "SessionController.listArchivedProjectSessionIdsForSessionsView"
)(function* (projectPath: string) {
  const request = yield* decodeVsCodeArgument(ListArchivedProjectSessionIdsRequestDtoSchema, {projectPath});

  return yield* listArchivedProjectSessionIds(request);
});

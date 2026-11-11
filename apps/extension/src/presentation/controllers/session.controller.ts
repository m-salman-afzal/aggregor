import {
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
  archiveSession,
  findViewedSessionId,
  getSessionListItem,
  listArchivedProjectSessionIds,
  listProjectSessionIds,
  listProjectsWithArchivedSessions,
  listSessionsWaitingOnUser,
  listWorkingSessionIds,
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

// The project row's button passes the row's node id.
export const newSessionInChosenProject = Effect.fn("SessionController.newSessionInChosenProject")(function* (
  projectNodeId: unknown
) {
  const request = yield* decodeProjectNodeRequest(NewSessionRequestDtoSchema, projectNodeId);
  yield* newSession(request);
});

// VS Code passes title-bar buttons the focused row, which can be any row, so its arguments are dropped and the user
// picks the project.
export const newSessionAskingForProject = Effect.fn("SessionController.newSessionAskingForProject")(function* () {
  const request = yield* decodeVsCodeArgument(NewSessionRequestDtoSchema, {});
  yield* newSession(request);
});

// The session row's click passes the row's node id.
export const openChosenSession = Effect.fn("SessionController.openChosenSession")(function* (sessionNodeId: unknown) {
  const request = yield* decodeSessionNodeRequest(OpenSessionRequestDtoSchema, sessionNodeId);
  yield* openSession(request);
});

// The session row's … menu passes the row's node id.
export const removeChosenSession = Effect.fn("SessionController.removeChosenSession")(function* (
  sessionNodeId: unknown
) {
  const request = yield* decodeSessionNodeRequest(RemoveSessionRequestDtoSchema, sessionNodeId);
  yield* removeSession(request);
});

// The Sessions view's session row's … menu passes the row's node id.
export const archiveChosenSession = Effect.fn("SessionController.archiveChosenSession")(function* (
  sessionNodeId: unknown
) {
  const request = yield* decodeSessionNodeRequest(ArchiveSessionRequestDtoSchema, sessionNodeId);
  yield* archiveSession(request);
});

// The Archive view's session row's … menu passes the row's node id.
export const unarchiveChosenSession = Effect.fn("SessionController.unarchiveChosenSession")(function* (
  sessionNodeId: unknown
) {
  const request = yield* decodeSessionNodeRequest(UnarchiveSessionRequestDtoSchema, sessionNodeId);
  yield* unarchiveSession(request);
});

// The session row's … menu, in either view, passes the row's node id.
export const stopChosenSessionAgent = Effect.fn("SessionController.stopChosenSessionAgent")(function* (
  sessionNodeId: unknown
) {
  const request = yield* decodeSessionNodeRequest(StopSessionAgentRequestDtoSchema, sessionNodeId);
  yield* stopSessionAgent(request);
});

// The Sessions view's project row's … menu passes the row's node id.
export const stopChosenProjectSessionAgents = Effect.fn("SessionController.stopChosenProjectSessionAgents")(function* (
  projectNodeId: unknown
) {
  const request = yield* decodeProjectNodeRequest(StopProjectSessionAgentsRequestDtoSchema, projectNodeId);
  yield* stopProjectSessionAgents(request);
});

// The Archive view's project row's … menu passes the row's node id.
export const stopChosenArchivedProjectSessionAgents = Effect.fn(
  "SessionController.stopChosenArchivedProjectSessionAgents"
)(function* (projectNodeId: unknown) {
  const request = yield* decodeProjectNodeRequest(StopArchivedProjectSessionAgentsRequestDtoSchema, projectNodeId);
  yield* stopArchivedProjectSessionAgents(request);
});

// VS Code passes the view title's … menu the focused row, which can be any row, so its arguments are dropped.
export const stopAllOngoingSessionAgents = Effect.fn("SessionController.stopAllOngoingSessionAgents")(function* () {
  yield* stopOngoingSessionAgents();
});

// VS Code passes the view title's … menu the focused row, which can be any row, so its arguments are dropped.
export const stopAllArchivedSessionAgents = Effect.fn("SessionController.stopAllArchivedSessionAgents")(function* () {
  yield* stopArchivedSessionAgents();
});

// The session row's … menu passes the row's node id.
export const renameChosenSession = Effect.fn("SessionController.renameChosenSession")(function* (
  sessionNodeId: unknown
) {
  const request = yield* decodeSessionNodeRequest(RenameSessionRequestDtoSchema, sessionNodeId);
  yield* renameSession(request);
});

// The session row's … menu passes the row's node id.
export const moveChosenSessionUp = Effect.fn("SessionController.moveChosenSessionUp")(function* (
  sessionNodeId: unknown
) {
  const request = yield* decodeSessionNodeRequest(MoveSessionUpRequestDtoSchema, sessionNodeId);
  yield* moveSessionUp(request);
});

// The session row's … menu passes the row's node id.
export const moveChosenSessionDown = Effect.fn("SessionController.moveChosenSessionDown")(function* (
  sessionNodeId: unknown
) {
  const request = yield* decodeSessionNodeRequest(MoveSessionDownRequestDtoSchema, sessionNodeId);
  yield* moveSessionDown(request);
});

// A session row dropped on another session row.
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

export const listWorkingSessionIdsForSessionsView = Effect.fn("SessionController.listWorkingSessionIdsForSessionsView")(
  function* () {
    return yield* listWorkingSessionIds();
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

export const listProjectsForArchiveView = Effect.fn("SessionController.listProjectsForArchiveView")(function* () {
  return yield* listProjectsWithArchivedSessions();
});

export const listProjectSessionIdsForArchiveView = Effect.fn("SessionController.listProjectSessionIdsForArchiveView")(
  function* (projectPath: string) {
    const request = yield* decodeVsCodeArgument(ListArchivedProjectSessionIdsRequestDtoSchema, {projectPath});

    return yield* listArchivedProjectSessionIds(request);
  }
);

export const getSessionListItemForArchiveView = Effect.fn("SessionController.getSessionListItemForArchiveView")(
  function* (sessionId: string) {
    const request = yield* decodeVsCodeArgument(GetSessionListItemRequestDtoSchema, {sessionId});

    return yield* getSessionListItem(request);
  }
);

export const listSessionsWaitingOnUserForArchiveView = Effect.fn(
  "SessionController.listSessionsWaitingOnUserForArchiveView"
)(function* () {
  return yield* listSessionsWaitingOnUser();
});

export const watchSessionListChangesForArchiveView = Effect.fn(
  "SessionController.watchSessionListChangesForArchiveView"
)(function* () {
  return yield* watchSessionListChanges();
});

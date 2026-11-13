import {
  ArchiveProjectSessionsRequestDtoSchema,
  ArchiveSessionRequestDtoSchema,
  GetSessionListItemRequestDtoSchema,
  ListProjectSessionsRequestDtoSchema,
  MoveSessionDownRequestDtoSchema,
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
import {
  archiveOngoingSessions,
  archiveProjectSessions,
  archiveSession,
  findViewedSessionId,
  getSessionListItem,
  listProjectSessions,
  listProjectsWithArchivedSessions,
  listProjectsWithSessions,
  listSessionsWaitingOnUser,
  moveSessionDown,
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
  chosenProject: unknown
) {
  const request = yield* decodeVsCodeArgument(NewSessionRequestDtoSchema, chosenProject);
  yield* newSession(request);
});

export const openChosenSession = Effect.fn("SessionController.openChosenSession")(function* (chosenSession: unknown) {
  const request = yield* decodeVsCodeArgument(OpenSessionRequestDtoSchema, chosenSession);
  yield* openSession(request);
});

export const removeChosenSession = Effect.fn("SessionController.removeChosenSession")(function* (
  chosenSession: unknown
) {
  const request = yield* decodeVsCodeArgument(RemoveSessionRequestDtoSchema, chosenSession);
  yield* removeSession(request);
});

export const archiveChosenSession = Effect.fn("SessionController.archiveChosenSession")(function* (
  chosenSession: unknown
) {
  const request = yield* decodeVsCodeArgument(ArchiveSessionRequestDtoSchema, chosenSession);
  yield* archiveSession(request);
});

export const unarchiveChosenSession = Effect.fn("SessionController.unarchiveChosenSession")(function* (
  chosenSession: unknown
) {
  const request = yield* decodeVsCodeArgument(UnarchiveSessionRequestDtoSchema, chosenSession);
  yield* unarchiveSession(request);
});

export const stopChosenSessionAgent = Effect.fn("SessionController.stopChosenSessionAgent")(function* (
  chosenSession: unknown
) {
  const request = yield* decodeVsCodeArgument(StopSessionAgentRequestDtoSchema, chosenSession);
  yield* stopSessionAgent(request);
});

export const stopChosenProjectSessionAgents = Effect.fn("SessionController.stopChosenProjectSessionAgents")(function* (
  chosenProject: unknown
) {
  const request = yield* decodeVsCodeArgument(StopProjectSessionAgentsRequestDtoSchema, chosenProject);
  yield* stopProjectSessionAgents(request);
});

export const stopChosenArchivedProjectSessionAgents = Effect.fn(
  "SessionController.stopChosenArchivedProjectSessionAgents"
)(function* (chosenProject: unknown) {
  const request = yield* decodeVsCodeArgument(StopArchivedProjectSessionAgentsRequestDtoSchema, chosenProject);
  yield* stopArchivedProjectSessionAgents(request);
});

export const archiveChosenProjectSessions = Effect.fn("SessionController.archiveChosenProjectSessions")(function* (
  chosenProject: unknown
) {
  const request = yield* decodeVsCodeArgument(ArchiveProjectSessionsRequestDtoSchema, chosenProject);
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
  chosenSession: unknown
) {
  const request = yield* decodeVsCodeArgument(RenameSessionRequestDtoSchema, chosenSession);
  yield* renameSession(request);
});

export const moveChosenSessionUp = Effect.fn("SessionController.moveChosenSessionUp")(function* (
  chosenSession: unknown
) {
  const request = yield* decodeVsCodeArgument(MoveSessionUpRequestDtoSchema, chosenSession);
  yield* moveSessionUp(request);
});

export const moveChosenSessionDown = Effect.fn("SessionController.moveChosenSessionDown")(function* (
  chosenSession: unknown
) {
  const request = yield* decodeVsCodeArgument(MoveSessionDownRequestDtoSchema, chosenSession);
  yield* moveSessionDown(request);
});

export const getSessionListItemForSessionsView = Effect.fn("SessionController.getSessionListItemForSessionsView")(
  function* (sessionId: string) {
    const request = yield* decodeVsCodeArgument(GetSessionListItemRequestDtoSchema, {sessionId});

    return yield* getSessionListItem(request);
  }
);

export const listProjectSessionsForSessionsView = Effect.fn("SessionController.listProjectSessionsForSessionsView")(
  function* (projectPath: string) {
    const request = yield* decodeVsCodeArgument(ListProjectSessionsRequestDtoSchema, {projectPath});

    return yield* listProjectSessions(request);
  }
);

export const listProjectsWithSessionsForSessionsView = Effect.fn(
  "SessionController.listProjectsWithSessionsForSessionsView"
)(function* () {
  return yield* listProjectsWithSessions();
});

export const listProjectsWithArchivedSessionsForSessionsView = Effect.fn(
  "SessionController.listProjectsWithArchivedSessionsForSessionsView"
)(function* () {
  return yield* listProjectsWithArchivedSessions();
});

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

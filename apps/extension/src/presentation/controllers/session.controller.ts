import {
  GetSessionListItemRequestDtoSchema,
  ListProjectSessionIdsRequestDtoSchema,
  NewSessionRequestDtoSchema,
  OpenSessionRequestDtoSchema,
  RemoveSessionRequestDtoSchema,
  RenameSessionRequestDtoSchema
} from "@dtos/session.dto.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {decodeProjectNodeRequest, decodeSessionNodeRequest} from "@presentationUtils/sessionsTreeNode.utils.ts";
import {
  findViewedSessionId,
  getSessionListItem,
  listProjectSessionIds,
  listWorkingSessionIds,
  newSession,
  openSession,
  removeSession,
  renameSession,
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

// The session row's … menu passes the row's node id.
export const renameChosenSession = Effect.fn("SessionController.renameChosenSession")(function* (
  sessionNodeId: unknown
) {
  const request = yield* decodeSessionNodeRequest(RenameSessionRequestDtoSchema, sessionNodeId);
  yield* renameSession(request);
});

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

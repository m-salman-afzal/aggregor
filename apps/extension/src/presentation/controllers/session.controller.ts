import {Context, Effect, Layer} from "effect";

import {
  ArchiveProjectSessionsRequestDtoSchema,
  ArchiveSessionRequestDtoSchema,
  ChangeSessionWorkingTreeRequestDtoSchema,
  GetProjectSessionsRequestDtoSchema,
  GetSessionListItemRequestDtoSchema,
  ListProjectSessionsRequestDtoSchema,
  MoveSessionDownRequestDtoSchema,
  MoveSessionUpRequestDtoSchema,
  NewSessionRequestDtoSchema,
  OpenSessionRequestDtoSchema,
  RemoveSessionRequestDtoSchema,
  RenameSessionBranchRequestDtoSchema,
  RenameSessionRequestDtoSchema,
  StopArchivedProjectSessionAgentsRequestDtoSchema,
  StopProjectSessionAgentsRequestDtoSchema,
  StopSessionAgentRequestDtoSchema,
  UnarchiveSessionRequestDtoSchema,
  UnlinkSessionWorktreeRequestDtoSchema
} from "@/dtos/session.dto.ts";
import {SessionErrorMessage} from "@/errorMessages/session.errorMessage.ts";
import {RegisterCommandMiddleware} from "@/middlewares/registerCommand.middleware.ts";
import {SessionService} from "@/services/session.service.ts";
import {SESSION_COMMANDS} from "@pkg/constants/src/session.constant.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";

export class SessionController extends Context.Service<SessionController>()(
  "aggregor-app/presentation/controllers/session.controller/SessionController",
  {
    make: Effect.fn("SessionController.make")(function* () {
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const sessionService = yield* SessionService;
      const sessionErrorMessage = yield* SessionErrorMessage;
      const vscodeUtils = yield* VscodeUtils;

      const createSessionInChosenProject = Effect.fn("SessionController.createSessionInChosenProject")(function* (
        chosenProject: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(NewSessionRequestDtoSchema, chosenProject);
        yield* sessionService.createSession(request);
      });

      const openChosenSession = Effect.fn("SessionController.openChosenSession")(function* (chosenSession: unknown) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(OpenSessionRequestDtoSchema, chosenSession);
        yield* sessionService.openSession(request);
      });

      const removeChosenSession = Effect.fn("SessionController.removeChosenSession")(function* (
        chosenSession: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(RemoveSessionRequestDtoSchema, chosenSession);
        yield* sessionService.removeSession(request);
      });

      const archiveChosenSession = Effect.fn("SessionController.archiveChosenSession")(function* (
        chosenSession: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(ArchiveSessionRequestDtoSchema, chosenSession);
        yield* sessionService.archiveSession(request);
      });

      const unarchiveChosenSession = Effect.fn("SessionController.unarchiveChosenSession")(function* (
        chosenSession: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(UnarchiveSessionRequestDtoSchema, chosenSession);
        yield* sessionService.unarchiveSession(request);
      });

      const stopChosenSessionAgent = Effect.fn("SessionController.stopChosenSessionAgent")(function* (
        chosenSession: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(StopSessionAgentRequestDtoSchema, chosenSession);
        yield* sessionService.stopSessionAgent(request);
      });

      const stopChosenProjectSessionAgents = Effect.fn("SessionController.stopChosenProjectSessionAgents")(function* (
        chosenProject: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(
          StopProjectSessionAgentsRequestDtoSchema,
          chosenProject
        );
        yield* sessionService.stopProjectSessionAgents(request);
      });

      const stopChosenArchivedProjectSessionAgents = Effect.fn(
        "SessionController.stopChosenArchivedProjectSessionAgents"
      )(function* (chosenProject: unknown) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(
          StopArchivedProjectSessionAgentsRequestDtoSchema,
          chosenProject
        );
        yield* sessionService.stopArchivedProjectSessionAgents(request);
      });

      const archiveChosenProjectSessions = Effect.fn("SessionController.archiveChosenProjectSessions")(function* (
        chosenProject: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(ArchiveProjectSessionsRequestDtoSchema, chosenProject);
        yield* sessionService.archiveProjectSessions(request);
      });

      const archiveAllOngoingSessions = Effect.fn("SessionController.archiveAllOngoingSessions")(function* () {
        yield* sessionService.archiveOngoingSessions;
      });

      const stopAllOngoingSessionAgents = Effect.fn("SessionController.stopAllOngoingSessionAgents")(function* () {
        yield* sessionService.stopOngoingSessionAgents;
      });

      const stopAllArchivedSessionAgents = Effect.fn("SessionController.stopAllArchivedSessionAgents")(function* () {
        yield* sessionService.stopArchivedSessionAgents;
      });

      const renameChosenSession = Effect.fn("SessionController.renameChosenSession")(function* (
        chosenSession: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(RenameSessionRequestDtoSchema, chosenSession);
        yield* sessionService.renameSession(request);
      });

      const renameChosenSessionBranch = Effect.fn("SessionController.renameChosenSessionBranch")(function* (
        chosenSession: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(RenameSessionBranchRequestDtoSchema, chosenSession);
        yield* sessionService.renameSessionBranch(request);
      });

      const changeChosenSessionWorkingTree = Effect.fn("SessionController.changeChosenSessionWorkingTree")(function* (
        chosenSession: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(
          ChangeSessionWorkingTreeRequestDtoSchema,
          chosenSession
        );
        yield* sessionService.changeSessionWorkingTree(request);
      });

      const unlinkChosenSessionWorktree = Effect.fn("SessionController.unlinkChosenSessionWorktree")(function* (
        chosenSession: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(UnlinkSessionWorktreeRequestDtoSchema, chosenSession);
        yield* sessionService.unlinkSessionWorktree(request);
      });

      const moveChosenSessionUp = Effect.fn("SessionController.moveChosenSessionUp")(function* (
        chosenSession: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(MoveSessionUpRequestDtoSchema, chosenSession);
        yield* sessionService.moveSessionUp(request);
      });

      const moveChosenSessionDown = Effect.fn("SessionController.moveChosenSessionDown")(function* (
        chosenSession: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(MoveSessionDownRequestDtoSchema, chosenSession);
        yield* sessionService.moveSessionDown(request);
      });

      const getSessionListItemForSessionsView = Effect.fn("SessionController.getSessionListItemForSessionsView")(
        function* (sessionId: string) {
          const request = yield* vscodeUtils.decodeVsCodeArgument(GetSessionListItemRequestDtoSchema, {sessionId});

          return yield* sessionService.getSessionListItem(request);
        }
      );

      const getProjectSessionsForSessionsView = Effect.fn("SessionController.getProjectSessionsForSessionsView")(
        function* (projectPath: string, shownPageCount: number) {
          const request = yield* vscodeUtils.decodeVsCodeArgument(GetProjectSessionsRequestDtoSchema, {
            projectPath,
            shownPageCount
          });

          return yield* sessionService.getProjectSessions(request);
        }
      );

      const listProjectsWithSessionsForSessionsView = Effect.fn(
        "SessionController.listProjectsWithSessionsForSessionsView"
      )(function* (shownPageCounts: Readonly<Record<string, number>>) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(ListProjectSessionsRequestDtoSchema, {shownPageCounts});

        return yield* sessionService.listProjectsWithSessions(request);
      });

      const listProjectsWithArchivedSessionsForSessionsView = Effect.fn(
        "SessionController.listProjectsWithArchivedSessionsForSessionsView"
      )(function* (shownPageCounts: Readonly<Record<string, number>>) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(ListProjectSessionsRequestDtoSchema, {shownPageCounts});

        return yield* sessionService.listProjectsWithArchivedSessions(request);
      });

      const listSessionsWaitingOnUserForSessionsView = Effect.fn(
        "SessionController.listSessionsWaitingOnUserForSessionsView"
      )(function* () {
        return yield* sessionService.listSessionsWaitingOnUser;
      });

      const watchSessionListChangesForSessionsView = Effect.fn(
        "SessionController.watchSessionListChangesForSessionsView"
      )(function* () {
        return yield* sessionService.watchSessionListChanges;
      });

      const watchViewedSessionIdsForSessionsView = Effect.fn("SessionController.watchViewedSessionIdsForSessionsView")(
        function* () {
          return yield* sessionService.watchViewedSessionIds;
        }
      );

      const findViewedSessionIdForSessionsView = Effect.fn("SessionController.findViewedSessionIdForSessionsView")(
        function* () {
          return yield* sessionService.findViewedSessionId;
        }
      );

      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.ARCHIVE,
        archiveChosenSession,
        sessionErrorMessage.getSessionCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.ARCHIVE_ONGOING,
        archiveAllOngoingSessions,
        sessionErrorMessage.getSessionCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.ARCHIVE_PROJECT_SESSIONS,
        archiveChosenProjectSessions,
        sessionErrorMessage.getSessionCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.CHANGE_WORKING_TREE,
        changeChosenSessionWorkingTree,
        sessionErrorMessage.getSessionCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.MOVE_DOWN,
        moveChosenSessionDown,
        sessionErrorMessage.getSessionCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.MOVE_UP,
        moveChosenSessionUp,
        sessionErrorMessage.getSessionCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.NEW_IN_CHOSEN_PROJECT,
        createSessionInChosenProject,
        sessionErrorMessage.getSessionCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.OPEN,
        openChosenSession,
        sessionErrorMessage.getSessionCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.REMOVE,
        removeChosenSession,
        sessionErrorMessage.getSessionCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.RENAME,
        renameChosenSession,
        sessionErrorMessage.getSessionCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.RENAME_BRANCH,
        renameChosenSessionBranch,
        sessionErrorMessage.getSessionCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.STOP_AGENT,
        stopChosenSessionAgent,
        sessionErrorMessage.getSessionCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.STOP_ARCHIVED_AGENTS,
        stopAllArchivedSessionAgents,
        sessionErrorMessage.getSessionCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.STOP_ARCHIVED_PROJECT_AGENTS,
        stopChosenArchivedProjectSessionAgents,
        sessionErrorMessage.getSessionCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.STOP_ONGOING_AGENTS,
        stopAllOngoingSessionAgents,
        sessionErrorMessage.getSessionCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.STOP_PROJECT_AGENTS,
        stopChosenProjectSessionAgents,
        sessionErrorMessage.getSessionCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.UNARCHIVE,
        unarchiveChosenSession,
        sessionErrorMessage.getSessionCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.UNLINK_WORKTREE,
        unlinkChosenSessionWorktree,
        sessionErrorMessage.getSessionCommandErrorMessage
      );

      return {
        archiveAllOngoingSessions: archiveAllOngoingSessions(),
        archiveChosenProjectSessions,
        archiveChosenSession,
        changeChosenSessionWorkingTree,
        createSessionInChosenProject,
        findViewedSessionIdForSessionsView: findViewedSessionIdForSessionsView(),
        getProjectSessionsForSessionsView,
        getSessionListItemForSessionsView,
        listProjectsWithArchivedSessionsForSessionsView,
        listProjectsWithSessionsForSessionsView,
        listSessionsWaitingOnUserForSessionsView: listSessionsWaitingOnUserForSessionsView(),
        moveChosenSessionDown,
        moveChosenSessionUp,
        openChosenSession,
        removeChosenSession,
        renameChosenSession,
        renameChosenSessionBranch,
        stopAllArchivedSessionAgents: stopAllArchivedSessionAgents(),
        stopAllOngoingSessionAgents: stopAllOngoingSessionAgents(),
        stopChosenArchivedProjectSessionAgents,
        stopChosenProjectSessionAgents,
        stopChosenSessionAgent,
        unarchiveChosenSession,
        unlinkChosenSessionWorktree,
        watchSessionListChangesForSessionsView: watchSessionListChangesForSessionsView(),
        watchViewedSessionIdsForSessionsView: watchViewedSessionIdsForSessionsView()
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([SessionErrorMessage.layer, RegisterCommandMiddleware.layer])
  );
}

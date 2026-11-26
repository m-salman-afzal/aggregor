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

import type {
  ArchiveProjectSessionsRequestDto,
  ArchiveSessionRequestDto,
  ChangeSessionWorkingTreeRequestDto,
  MoveSessionDownRequestDto,
  MoveSessionUpRequestDto,
  NewSessionRequestDto,
  OpenSessionRequestDto,
  RemoveSessionRequestDto,
  RenameSessionBranchRequestDto,
  RenameSessionRequestDto,
  StopArchivedProjectSessionAgentsRequestDto,
  StopProjectSessionAgentsRequestDto,
  StopSessionAgentRequestDto,
  UnarchiveSessionRequestDto,
  UnlinkSessionWorktreeRequestDto
} from "@/dtos/session.dto.ts";

export class SessionController extends Context.Service<SessionController>()(
  "aggregor-app/presentation/controllers/session.controller/SessionController",
  {
    make: Effect.fn("SessionController.make")(function* () {
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const sessionService = yield* SessionService;
      const sessionErrorMessage = yield* SessionErrorMessage;
      const vscodeUtils = yield* VscodeUtils;

      const createSessionInChosenProject = Effect.fn("SessionController.createSessionInChosenProject")(function* (
        request: NewSessionRequestDto
      ) {
        yield* sessionService.createSession(request);
      });

      const openChosenSession = Effect.fn("SessionController.openChosenSession")(function* (
        request: OpenSessionRequestDto
      ) {
        yield* sessionService.openSession(request);
      });

      const removeChosenSession = Effect.fn("SessionController.removeChosenSession")(function* (
        request: RemoveSessionRequestDto
      ) {
        yield* sessionService.removeSession(request);
      });

      const archiveChosenSession = Effect.fn("SessionController.archiveChosenSession")(function* (
        request: ArchiveSessionRequestDto
      ) {
        yield* sessionService.archiveSession(request);
      });

      const unarchiveChosenSession = Effect.fn("SessionController.unarchiveChosenSession")(function* (
        request: UnarchiveSessionRequestDto
      ) {
        yield* sessionService.unarchiveSession(request);
      });

      const stopChosenSessionAgent = Effect.fn("SessionController.stopChosenSessionAgent")(function* (
        request: StopSessionAgentRequestDto
      ) {
        yield* sessionService.stopSessionAgent(request);
      });

      const stopChosenProjectSessionAgents = Effect.fn("SessionController.stopChosenProjectSessionAgents")(function* (
        request: StopProjectSessionAgentsRequestDto
      ) {
        yield* sessionService.stopProjectSessionAgents(request);
      });

      const stopChosenArchivedProjectSessionAgents = Effect.fn(
        "SessionController.stopChosenArchivedProjectSessionAgents"
      )(function* (request: StopArchivedProjectSessionAgentsRequestDto) {
        yield* sessionService.stopArchivedProjectSessionAgents(request);
      });

      const archiveChosenProjectSessions = Effect.fn("SessionController.archiveChosenProjectSessions")(function* (
        request: ArchiveProjectSessionsRequestDto
      ) {
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
        request: RenameSessionRequestDto
      ) {
        yield* sessionService.renameSession(request);
      });

      const renameChosenSessionBranch = Effect.fn("SessionController.renameChosenSessionBranch")(function* (
        request: RenameSessionBranchRequestDto
      ) {
        yield* sessionService.renameSessionBranch(request);
      });

      const changeChosenSessionWorkingTree = Effect.fn("SessionController.changeChosenSessionWorkingTree")(function* (
        request: ChangeSessionWorkingTreeRequestDto
      ) {
        yield* sessionService.changeSessionWorkingTree(request);
      });

      const unlinkChosenSessionWorktree = Effect.fn("SessionController.unlinkChosenSessionWorktree")(function* (
        request: UnlinkSessionWorktreeRequestDto
      ) {
        yield* sessionService.unlinkSessionWorktree(request);
      });

      const moveChosenSessionUp = Effect.fn("SessionController.moveChosenSessionUp")(function* (
        request: MoveSessionUpRequestDto
      ) {
        yield* sessionService.moveSessionUp(request);
      });

      const moveChosenSessionDown = Effect.fn("SessionController.moveChosenSessionDown")(function* (
        request: MoveSessionDownRequestDto
      ) {
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

      yield* registerCommandMiddleware.registerCommand({
        commandId: SESSION_COMMANDS.ARCHIVE,
        controller: archiveChosenSession,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage,
        requestSchema: ArchiveSessionRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommandWithoutRequest({
        commandId: SESSION_COMMANDS.ARCHIVE_ONGOING,
        controller: archiveAllOngoingSessions,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: SESSION_COMMANDS.ARCHIVE_PROJECT_SESSIONS,
        controller: archiveChosenProjectSessions,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage,
        requestSchema: ArchiveProjectSessionsRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: SESSION_COMMANDS.CHANGE_WORKING_TREE,
        controller: changeChosenSessionWorkingTree,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage,
        requestSchema: ChangeSessionWorkingTreeRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: SESSION_COMMANDS.MOVE_DOWN,
        controller: moveChosenSessionDown,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage,
        requestSchema: MoveSessionDownRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: SESSION_COMMANDS.MOVE_UP,
        controller: moveChosenSessionUp,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage,
        requestSchema: MoveSessionUpRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: SESSION_COMMANDS.NEW_IN_CHOSEN_PROJECT,
        controller: createSessionInChosenProject,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage,
        requestSchema: NewSessionRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: SESSION_COMMANDS.OPEN,
        controller: openChosenSession,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage,
        requestSchema: OpenSessionRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: SESSION_COMMANDS.REMOVE,
        controller: removeChosenSession,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage,
        requestSchema: RemoveSessionRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: SESSION_COMMANDS.RENAME,
        controller: renameChosenSession,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage,
        requestSchema: RenameSessionRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: SESSION_COMMANDS.RENAME_BRANCH,
        controller: renameChosenSessionBranch,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage,
        requestSchema: RenameSessionBranchRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: SESSION_COMMANDS.STOP_AGENT,
        controller: stopChosenSessionAgent,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage,
        requestSchema: StopSessionAgentRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommandWithoutRequest({
        commandId: SESSION_COMMANDS.STOP_ARCHIVED_AGENTS,
        controller: stopAllArchivedSessionAgents,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: SESSION_COMMANDS.STOP_ARCHIVED_PROJECT_AGENTS,
        controller: stopChosenArchivedProjectSessionAgents,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage,
        requestSchema: StopArchivedProjectSessionAgentsRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommandWithoutRequest({
        commandId: SESSION_COMMANDS.STOP_ONGOING_AGENTS,
        controller: stopAllOngoingSessionAgents,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: SESSION_COMMANDS.STOP_PROJECT_AGENTS,
        controller: stopChosenProjectSessionAgents,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage,
        requestSchema: StopProjectSessionAgentsRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: SESSION_COMMANDS.UNARCHIVE,
        controller: unarchiveChosenSession,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage,
        requestSchema: UnarchiveSessionRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: SESSION_COMMANDS.UNLINK_WORKTREE,
        controller: unlinkChosenSessionWorktree,
        getCommandErrorMessage: sessionErrorMessage.getSessionCommandErrorMessage,
        requestSchema: UnlinkSessionWorktreeRequestDtoSchema
      });

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

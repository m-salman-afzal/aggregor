import {Context, Effect, Layer} from "effect";

import {
  LinkSessionPullRequestRequestDtoSchema,
  ListSessionPullRequestsRequestDtoSchema,
  OpenSessionPullRequestRequestDtoSchema,
  UnlinkSessionPullRequestRequestDtoSchema
} from "@/dtos/pullRequest.dto.ts";
import {PullRequestErrorMessage} from "@/errorMessages/pullRequest.errorMessage.ts";
import {RegisterCommandMiddleware} from "@/middlewares/registerCommand.middleware.ts";
import {PullRequestService} from "@/services/pullRequest.service.ts";
import {GITHUB_CLI_COMMANDS} from "@pkg/constants/src/gitHubCli.constant.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";

import type {
  LinkSessionPullRequestRequestDto,
  OpenSessionPullRequestRequestDto,
  UnlinkSessionPullRequestRequestDto
} from "@/dtos/pullRequest.dto.ts";

export class PullRequestController extends Context.Service<PullRequestController>()(
  "aggregor-app/presentation/controllers/pullRequest.controller/PullRequestController",
  {
    make: Effect.fn("PullRequestController.make")(function* () {
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const pullRequestService = yield* PullRequestService;
      const pullRequestErrorMessage = yield* PullRequestErrorMessage;
      const vscodeUtils = yield* VscodeUtils;

      const openChosenSessionPullRequest = Effect.fn("PullRequestController.openChosenSessionPullRequest")(function* (
        request: OpenSessionPullRequestRequestDto
      ) {
        yield* pullRequestService.openSessionPullRequest(request);
      });

      const linkChosenSessionPullRequest = Effect.fn("PullRequestController.linkChosenSessionPullRequest")(function* (
        request: LinkSessionPullRequestRequestDto
      ) {
        yield* pullRequestService.linkSessionPullRequest(request);
      });

      const unlinkChosenSessionPullRequest = Effect.fn("PullRequestController.unlinkChosenSessionPullRequest")(
        function* (request: UnlinkSessionPullRequestRequestDto) {
          yield* pullRequestService.unlinkSessionPullRequest(request);
        }
      );

      const listSessionPullRequestsForSessionsView = Effect.fn(
        "PullRequestController.listSessionPullRequestsForSessionsView"
      )(function* (sessionId: string) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(ListSessionPullRequestsRequestDtoSchema, {sessionId});

        return yield* pullRequestService.listSessionPullRequests(request);
      });

      const signInToGitHubCliFromNotice = Effect.fn("PullRequestController.signInToGitHubCliFromNotice")(function* () {
        yield* pullRequestService.signInToGitHubCli;
      });

      const watchGitHubCliSignedOutForGitHubCliNoticesView = Effect.fn(
        "PullRequestController.watchGitHubCliSignedOutForGitHubCliNoticesView"
      )(function* () {
        return yield* pullRequestService.watchGitHubCliSignedOut;
      });

      yield* registerCommandMiddleware.registerCommand({
        commandId: GITHUB_CLI_COMMANDS.OPEN_SESSION_PULL_REQUEST,
        controller: openChosenSessionPullRequest,
        getCommandErrorMessage: pullRequestErrorMessage.getPullRequestCommandErrorMessage,
        requestSchema: OpenSessionPullRequestRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: GITHUB_CLI_COMMANDS.LINK_SESSION_PULL_REQUEST,
        controller: linkChosenSessionPullRequest,
        getCommandErrorMessage: pullRequestErrorMessage.getPullRequestCommandErrorMessage,
        requestSchema: LinkSessionPullRequestRequestDtoSchema
      });
      yield* registerCommandMiddleware.registerCommandWithoutRequest({
        commandId: GITHUB_CLI_COMMANDS.SIGN_IN,
        controller: signInToGitHubCliFromNotice,
        getCommandErrorMessage: pullRequestErrorMessage.getPullRequestCommandErrorMessage
      });
      yield* registerCommandMiddleware.registerCommand({
        commandId: GITHUB_CLI_COMMANDS.UNLINK_SESSION_PULL_REQUEST,
        controller: unlinkChosenSessionPullRequest,
        getCommandErrorMessage: pullRequestErrorMessage.getPullRequestCommandErrorMessage,
        requestSchema: UnlinkSessionPullRequestRequestDtoSchema
      });

      return {
        linkChosenSessionPullRequest,
        listSessionPullRequestsForSessionsView,
        openChosenSessionPullRequest,
        signInToGitHubCliFromNotice: signInToGitHubCliFromNotice(),
        unlinkChosenSessionPullRequest,
        watchGitHubCliSignedOutForGitHubCliNoticesView: watchGitHubCliSignedOutForGitHubCliNoticesView()
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([PullRequestErrorMessage.layer, RegisterCommandMiddleware.layer])
  );
}

import {
  LinkSessionPullRequestRequestDtoSchema,
  ListSessionPullRequestsRequestDtoSchema,
  OpenSessionPullRequestRequestDtoSchema,
  UnlinkSessionPullRequestRequestDtoSchema
} from "@dtos/pullRequest.dto.ts";
import {PullRequestErrorMessage} from "@errorMessages/pullRequest.errorMessage.ts";
import {RegisterCommandMiddleware} from "@middlewares/registerCommand.middleware.ts";
import {GITHUB_CLI_COMMANDS} from "@pkg/constants/src/gitHubCli.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {PullRequestService} from "@services/pullRequest.service.ts";
import {Context, Effect, Layer} from "effect";

export class PullRequestController extends Context.Service<PullRequestController>()(
  "aggregor-app/presentation/controllers/pullRequest.controller/PullRequestController",
  {
    make: Effect.fn("make")(function* () {
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const pullRequestService = yield* PullRequestService;
      const pullRequestErrorMessage = yield* PullRequestErrorMessage;
      const vscodeUtils = yield* VscodeUtils;

      const openChosenSessionPullRequest = Effect.fn("openChosenSessionPullRequest")(function* (
        chosenSession: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(OpenSessionPullRequestRequestDtoSchema, chosenSession);
        yield* pullRequestService.openSessionPullRequest(request);
      });

      const linkChosenSessionPullRequest = Effect.fn("linkChosenSessionPullRequest")(function* (
        chosenPullRequest: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(
          LinkSessionPullRequestRequestDtoSchema,
          chosenPullRequest
        );
        yield* pullRequestService.linkSessionPullRequest(request);
      });

      const unlinkChosenSessionPullRequest = Effect.fn("unlinkChosenSessionPullRequest")(function* (
        chosenSession: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(
          UnlinkSessionPullRequestRequestDtoSchema,
          chosenSession
        );
        yield* pullRequestService.unlinkSessionPullRequest(request);
      });

      const listSessionPullRequestsForSessionsView = Effect.fn("listSessionPullRequestsForSessionsView")(function* (
        sessionId: string
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(ListSessionPullRequestsRequestDtoSchema, {sessionId});

        return yield* pullRequestService.listSessionPullRequests(request);
      });

      const signInToGitHubCliFromNotice = Effect.fn("signInToGitHubCliFromNotice")(function* () {
        yield* pullRequestService.signInToGitHubCli;
      });

      const watchGitHubCliSignedOutForGitHubCliNoticesView = Effect.fn(
        "watchGitHubCliSignedOutForGitHubCliNoticesView"
      )(function* () {
        return yield* pullRequestService.watchGitHubCliSignedOut;
      });

      yield* registerCommandMiddleware.registerCommand(
        GITHUB_CLI_COMMANDS.OPEN_SESSION_PULL_REQUEST,
        openChosenSessionPullRequest,
        pullRequestErrorMessage.getPullRequestCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        GITHUB_CLI_COMMANDS.LINK_SESSION_PULL_REQUEST,
        linkChosenSessionPullRequest,
        pullRequestErrorMessage.getPullRequestCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        GITHUB_CLI_COMMANDS.SIGN_IN,
        signInToGitHubCliFromNotice,
        pullRequestErrorMessage.getPullRequestCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        GITHUB_CLI_COMMANDS.UNLINK_SESSION_PULL_REQUEST,
        unlinkChosenSessionPullRequest,
        pullRequestErrorMessage.getPullRequestCommandErrorMessage
      );

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
  public static readonly layer = Layer.effect(this, ownSpans("PullRequestController", this.make())).pipe(
    Layer.provide([PullRequestErrorMessage.layer, RegisterCommandMiddleware.layer])
  );
}

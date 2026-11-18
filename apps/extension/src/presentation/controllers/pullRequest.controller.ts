import {
  LinkSessionPullRequestRequestDtoSchema,
  ListSessionPullRequestsRequestDtoSchema,
  OpenSessionPullRequestRequestDtoSchema,
  UnlinkSessionPullRequestRequestDtoSchema
} from "@dtos/pullRequest.dto.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {
  linkSessionPullRequest,
  listSessionPullRequests,
  openSessionPullRequest,
  signInToGitHubCli,
  unlinkSessionPullRequest,
  watchGitHubCliSignedOut
} from "@services/pullRequest.service.ts";
import {Effect} from "effect";

export const openChosenSessionPullRequest = Effect.fn("PullRequestController.openChosenSessionPullRequest")(function* (
  chosenSession: unknown
) {
  const request = yield* decodeVsCodeArgument(OpenSessionPullRequestRequestDtoSchema, chosenSession);
  yield* openSessionPullRequest(request);
});

export const linkChosenSessionPullRequest = Effect.fn("PullRequestController.linkChosenSessionPullRequest")(function* (
  chosenPullRequest: unknown
) {
  const request = yield* decodeVsCodeArgument(LinkSessionPullRequestRequestDtoSchema, chosenPullRequest);
  yield* linkSessionPullRequest(request);
});

export const unlinkChosenSessionPullRequest = Effect.fn("PullRequestController.unlinkChosenSessionPullRequest")(
  function* (chosenSession: unknown) {
    const request = yield* decodeVsCodeArgument(UnlinkSessionPullRequestRequestDtoSchema, chosenSession);
    yield* unlinkSessionPullRequest(request);
  }
);

export const listSessionPullRequestsForSessionsView = Effect.fn(
  "PullRequestController.listSessionPullRequestsForSessionsView"
)(function* (sessionId: string) {
  const request = yield* decodeVsCodeArgument(ListSessionPullRequestsRequestDtoSchema, {sessionId});

  return yield* listSessionPullRequests(request);
});

export const signInToGitHubCliFromNotice = Effect.fn("PullRequestController.signInToGitHubCliFromNotice")(function* () {
  yield* signInToGitHubCli();
});

export const watchGitHubCliSignedOutForGitHubCliNoticesView = Effect.fn(
  "PullRequestController.watchGitHubCliSignedOutForGitHubCliNoticesView"
)(function* () {
  return yield* watchGitHubCliSignedOut();
});

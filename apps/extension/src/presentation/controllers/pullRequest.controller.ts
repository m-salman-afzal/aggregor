import {OpenSessionPullRequestRequestDtoSchema} from "@dtos/pullRequest.dto.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {openSessionPullRequest, signInToGitHubCli, watchGitHubCliSignedOut} from "@services/pullRequest.service.ts";
import {Effect} from "effect";

export const openChosenSessionPullRequest = Effect.fn("PullRequestController.openChosenSessionPullRequest")(function* (
  chosenSession: unknown
) {
  const request = yield* decodeVsCodeArgument(OpenSessionPullRequestRequestDtoSchema, chosenSession);
  yield* openSessionPullRequest(request);
});

export const signInToGitHubCliFromNotice = Effect.fn("PullRequestController.signInToGitHubCliFromNotice")(function* () {
  yield* signInToGitHubCli();
});

export const watchGitHubCliSignedOutForGitHubCliNoticesView = Effect.fn(
  "PullRequestController.watchGitHubCliSignedOutForGitHubCliNoticesView"
)(function* () {
  return yield* watchGitHubCliSignedOut();
});

import {OpenSessionPullRequestRequestDtoSchema} from "@dtos/pullRequest.dto.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {
  installGitHubCli,
  openSessionPullRequest,
  signInToGitHubCli,
  watchGitHubCliProblems
} from "@services/pullRequest.service.ts";
import {Effect} from "effect";

export const openChosenSessionPullRequest = Effect.fn("PullRequestController.openChosenSessionPullRequest")(function* (
  chosenSession: unknown
) {
  const request = yield* decodeVsCodeArgument(OpenSessionPullRequestRequestDtoSchema, chosenSession);
  yield* openSessionPullRequest(request);
});

export const installGitHubCliFromNotice = Effect.fn("PullRequestController.installGitHubCliFromNotice")(function* () {
  yield* installGitHubCli();
});

export const signInToGitHubCliFromNotice = Effect.fn("PullRequestController.signInToGitHubCliFromNotice")(function* () {
  yield* signInToGitHubCli();
});

export const watchGitHubCliProblemsForGitHubCliNoticesView = Effect.fn(
  "PullRequestController.watchGitHubCliProblemsForGitHubCliNoticesView"
)(function* () {
  return yield* watchGitHubCliProblems();
});

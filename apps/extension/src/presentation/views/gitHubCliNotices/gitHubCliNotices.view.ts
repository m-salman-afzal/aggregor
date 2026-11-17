import {watchGitHubCliSignedOutForGitHubCliNoticesView} from "@controllers/pullRequest.controller.ts";
import {GITHUB_CLI_COMMANDS, GITHUB_CLI_LABELS, GITHUB_CLI_NOTICES} from "@pkg/constants/src/gitHubCli.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {Effect, Layer, Stream} from "effect";

const offerGitHubCliSignIn = Effect.fn("GitHubCliNoticesView.offerGitHubCliSignIn")(function* () {
  const vsCodeApi = yield* VsCodeApi;
  const pickedAction = yield* Effect.promise(() =>
    vsCodeApi.window.showInformationMessage(GITHUB_CLI_NOTICES.SIGNED_OUT, GITHUB_CLI_LABELS.SIGN_IN)
  );

  if (pickedAction === GITHUB_CLI_LABELS.SIGN_IN)
    yield* Effect.promise(() => vsCodeApi.commands.executeCommand(GITHUB_CLI_COMMANDS.SIGN_IN));
});

const makeGitHubCliNoticesView = Effect.fn("GitHubCliNoticesView.make")(function* () {
  const gitHubCliSignedOutProblems = yield* watchGitHubCliSignedOutForGitHubCliNoticesView();

  // In the background, so a notice waiting for a click holds back no other.
  yield* Effect.forkScoped(
    Stream.runForEach(gitHubCliSignedOutProblems, () => Effect.forkScoped(offerGitHubCliSignIn()))
  );
});

export const GitHubCliNoticesView = Layer.effectDiscard(makeGitHubCliNoticesView());

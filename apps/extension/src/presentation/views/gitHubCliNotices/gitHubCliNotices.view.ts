import {Context, Effect, Layer, Stream} from "effect";

import {PullRequestController} from "@/controllers/pullRequest.controller.ts";
import {GITHUB_CLI_COMMANDS, GITHUB_CLI_LABELS, GITHUB_CLI_NOTICES} from "@pkg/constants/src/gitHubCli.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";

export class GitHubCliNoticesView extends Context.Service<GitHubCliNoticesView>()(
  "aggregor-app/presentation/views/gitHubCliNotices/gitHubCliNotices.view/GitHubCliNoticesView",
  {
    make: Effect.fn("GitHubCliNoticesView.make")(function* () {
      const pullRequestController = yield* PullRequestController;
      const vsCodeApi = yield* VsCodeApi;

      const showGitHubCliSignInNotice = Effect.fn("GitHubCliNoticesView.showGitHubCliSignInNotice")(function* () {
        const pickedAction = yield* Effect.promise(() =>
          vsCodeApi.window.showInformationMessage(GITHUB_CLI_NOTICES.SIGNED_OUT, GITHUB_CLI_LABELS.SIGN_IN)
        );

        if (pickedAction === GITHUB_CLI_LABELS.SIGN_IN)
          yield* Effect.promise(() => vsCodeApi.commands.executeCommand(GITHUB_CLI_COMMANDS.SIGN_IN));
      });

      const gitHubCliSignedOutProblems = yield* pullRequestController.watchGitHubCliSignedOutForGitHubCliNoticesView;

      // In the background, so a notice waiting for a click holds back no other.
      yield* Effect.forkScoped(
        Stream.runForEach(gitHubCliSignedOutProblems, () => Effect.forkScoped(showGitHubCliSignInNotice()))
      );

      return {};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(Layer.provide(PullRequestController.layer));
}

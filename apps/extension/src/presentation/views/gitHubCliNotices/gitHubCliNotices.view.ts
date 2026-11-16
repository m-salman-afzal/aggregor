import {watchGitHubCliProblemsForGitHubCliNoticesView} from "@controllers/pullRequest.controller.ts";
import {
  GITHUB_CLI,
  GITHUB_CLI_COMMANDS,
  GITHUB_CLI_LABELS,
  GITHUB_CLI_NOTICES
} from "@pkg/constants/src/gitHubCli.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {Effect, Layer, Match, Stream} from "effect";

import type {GitHubCliProblemDto} from "@dtos/pullRequest.dto.ts";

// Install gh runs the package manager's command in a terminal; with none, the install page says how.
const offerGitHubCliInstall = Effect.fn("GitHubCliNoticesView.offerGitHubCliInstall")(function* (
  installCommandLine: string | undefined
) {
  const vsCodeApi = yield* VsCodeApi;
  if (installCommandLine === undefined) {
    const pickedAction = yield* Effect.promise(() =>
      vsCodeApi.window.showInformationMessage(
        GITHUB_CLI_NOTICES.NOT_INSTALLED_WITHOUT_PACKAGE_MANAGER,
        GITHUB_CLI_LABELS.INSTALL_PAGE
      )
    );
    if (pickedAction === GITHUB_CLI_LABELS.INSTALL_PAGE)
      yield* Effect.promise(() => vsCodeApi.env.openExternal(vsCodeApi.Uri.parse(GITHUB_CLI.INSTALL_PAGE)));

    return;
  }
  const pickedAction = yield* Effect.promise(() =>
    vsCodeApi.window.showInformationMessage(
      GITHUB_CLI_NOTICES.NOT_INSTALLED(installCommandLine),
      GITHUB_CLI_LABELS.INSTALL
    )
  );
  if (pickedAction === GITHUB_CLI_LABELS.INSTALL)
    yield* Effect.promise(() => vsCodeApi.commands.executeCommand(GITHUB_CLI_COMMANDS.INSTALL));
});

const offerGitHubCliSignIn = Effect.fn("GitHubCliNoticesView.offerGitHubCliSignIn")(function* () {
  const vsCodeApi = yield* VsCodeApi;
  const pickedAction = yield* Effect.promise(() =>
    vsCodeApi.window.showInformationMessage(GITHUB_CLI_NOTICES.SIGNED_OUT, GITHUB_CLI_LABELS.SIGN_IN)
  );

  if (pickedAction === GITHUB_CLI_LABELS.SIGN_IN)
    yield* Effect.promise(() => vsCodeApi.commands.executeCommand(GITHUB_CLI_COMMANDS.SIGN_IN));
});

// In the background, so a notice waiting for a click holds back no other.
const showGitHubCliProblem = Effect.fn("GitHubCliNoticesView.showGitHubCliProblem")(function* (
  gitHubCliProblem: GitHubCliProblemDto
) {
  yield* Effect.forkScoped(
    Match.valueTags(gitHubCliProblem, {
      GitHubCliMissing: (gitHubCliMissing) => offerGitHubCliInstall(gitHubCliMissing.installCommandLine),
      GitHubCliSignedOut: () => offerGitHubCliSignIn()
    })
  );
});

const makeGitHubCliNoticesView = Effect.fn("GitHubCliNoticesView.make")(function* () {
  const gitHubCliProblems = yield* watchGitHubCliProblemsForGitHubCliNoticesView();

  yield* Effect.forkScoped(Stream.runForEach(gitHubCliProblems, showGitHubCliProblem));
});

export const GitHubCliNoticesView = Layer.effectDiscard(makeGitHubCliNoticesView());

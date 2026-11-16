import {GitHubCliProblemDtoSchema} from "@dtos/pullRequest.dto.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {IGitHubCliInfraService} from "@interfaces/gitHubCli.infraService.interface.ts";
import {ISettingsConfig} from "@interfaces/settings.config.interface.ts";
import {IShellCommandInfraService} from "@interfaces/shellCommand.infraService.interface.ts";
import {IWorktreeInfraService} from "@interfaces/worktree.infraService.interface.ts";
import {
  GITHUB_CLI,
  GITHUB_CLI_INSTALL_COMMANDS,
  PULL_REQUEST_OPEN_PLACES
} from "@pkg/constants/src/gitHubCli.constant.ts";
import {findSession, SessionNotInWorktreeError} from "@services/session.service.ts";
import {AGENT_STATUSES} from "@valueObjects/agentStatus.valueObject.ts";
import {ENTITY_CHANGE_KINDS} from "@valueObjects/entityChangeKind.valueObject.ts";
import {Array, DateTime, Effect, Match, Ref, Result, Schema, Stream} from "effect";

import type {OpenSessionPullRequestRequestDto} from "@dtos/pullRequest.dto.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {GitHubCliProblem} from "@interfaces/gitHubCli.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

export class NoPackageManagerError extends Schema.TaggedError<NoPackageManagerError, {readonly brand: unique symbol}>()(
  "NoPackageManagerError",
  {}
) {}

const findSessionPullRequestBranch = Effect.fn("PullRequestService.findSessionPullRequestBranch")(function* (
  session: SessionEntity
) {
  const worktreePath = session.worktreePath;
  if (worktreePath === undefined) return yield* SessionNotInWorktreeError.make();
  const branchName = yield* IWorktreeInfraService.use((worktreeInfraService) =>
    worktreeInfraService.readBranchName(worktreePath)
  );

  return {branchName, folderPath: worktreePath};
});

// Where aggregorApp.openPullRequestIn says.
export const openSessionPullRequest = Effect.fn("PullRequestService.openSessionPullRequest")(function* (
  request: OpenSessionPullRequestRequestDto
) {
  const gitHubCliInfraService = yield* IGitHubCliInfraService;
  const session = yield* findSession(request.sessionId);
  const pullRequestBranch = yield* findSessionPullRequestBranch(session);
  const pullRequest = yield* gitHubCliInfraService.findPullRequest(pullRequestBranch);
  const pullRequestSettings = yield* ISettingsConfig.use((settingsConfig) => settingsConfig.readPullRequestSettings);
  yield* Effect.annotateCurrentSpan({openPullRequestIn: pullRequestSettings.openPullRequestIn});

  yield* pullRequestSettings.openPullRequestIn === PULL_REQUEST_OPEN_PLACES.VS_CODE
    ? gitHubCliInfraService.openPullRequestInVsCode(pullRequest)
    : gitHubCliInfraService.openPullRequestInBrowser(pullRequest);
});

// Looked up when asked, so a package manager installed since counts.
const findGitHubCliInstallCommandLine = Effect.fn("PullRequestService.findGitHubCliInstallCommandLine")(function* () {
  const installedCommands = yield* IShellCommandInfraService.use((shellCommandInfraService) =>
    shellCommandInfraService.listInstalledCommands(
      Array.map(GITHUB_CLI_INSTALL_COMMANDS, (installCommand) => installCommand.packageManager)
    )
  );
  const installCommand = Array.findFirst(GITHUB_CLI_INSTALL_COMMANDS, (candidateCommand) =>
    installedCommands.has(candidateCommand.packageManager)
  );

  return yield* Effect.fromResult(
    Result.map(
      Result.fromOption(installCommand, () => NoPackageManagerError.make()),
      (foundCommand) => foundCommand.commandLine
    )
  );
});

export const installGitHubCli = Effect.fn("PullRequestService.installGitHubCli")(function* () {
  const installCommandLine = yield* findGitHubCliInstallCommandLine();

  yield* IGitHubCliInfraService.use((gitHubCliInfraService) =>
    gitHubCliInfraService.openGitHubCliTerminal(installCommandLine)
  );
});

export const signInToGitHubCli = Effect.fn("PullRequestService.signInToGitHubCli")(function* () {
  yield* IGitHubCliInfraService.use((gitHubCliInfraService) =>
    gitHubCliInfraService.openGitHubCliTerminal(GITHUB_CLI.SIGN_IN_COMMAND_LINE)
  );
});

const toGitHubCliProblemDto = Effect.fn("PullRequestService.toGitHubCliProblemDto")(function* (
  gitHubCliProblem: GitHubCliProblem
) {
  const installCommandLineResult = yield* Effect.result(findGitHubCliInstallCommandLine());

  return Match.valueTags(gitHubCliProblem, {
    GitHubCliNotFoundError: () =>
      GitHubCliProblemDtoSchema.cases.GitHubCliMissing.make({
        installCommandLine: Result.getOrUndefined(installCommandLineResult)
      }),
    GitHubCliSignedOutError: () => GitHubCliProblemDtoSchema.cases.GitHubCliSignedOut.make({})
  });
});

export const watchGitHubCliProblems = Effect.fn("PullRequestService.watchGitHubCliProblems")(function* () {
  const gitHubCliInfraService = yield* IGitHubCliInfraService;
  const shellCommandInfraService = yield* IShellCommandInfraService;

  return Stream.mapEffect(gitHubCliInfraService.gitHubCliProblems, (gitHubCliProblem) =>
    Effect.provideService(toGitHubCliProblemDto(gitHubCliProblem), IShellCommandInfraService, shellCommandInfraService)
  );
});

// A session outside a worktree, or in one git no longer knows, has no branch to look up.
const refreshSessionPullRequest = Effect.fn("PullRequestService.refreshSessionPullRequest")(
  function* (session: SessionEntity) {
    const pullRequestBranch = yield* findSessionPullRequestBranch(session);

    yield* IGitHubCliInfraService.use((gitHubCliInfraService) =>
      gitHubCliInfraService.refreshPullRequest(pullRequestBranch)
    );
  },
  Effect.catchTags({NotGitRepositoryError: () => Effect.void, SessionNotInWorktreeError: () => Effect.void})
);

// A row is written for many reasons, so a turn's end is a new status change to finished or idle.
const isNewTurnEnd = Effect.fn("PullRequestService.isNewTurnEnd")(function* (
  lastStatusChangeTimes: ReadonlyMap<EntityIdValueObject, number>,
  updatedSession: SessionEntity
) {
  const statusChangedAt =
    updatedSession.statusChangedAt === undefined ? 0 : DateTime.toEpochMillis(updatedSession.statusChangedAt);

  return (
    lastStatusChangeTimes.get(updatedSession.id) !== statusChangedAt &&
    (updatedSession.status === AGENT_STATUSES.DONE || updatedSession.status === AGENT_STATUSES.IDLE)
  );
});

const refreshAfterTurnEnd = Effect.fn("PullRequestService.refreshAfterTurnEnd")(function* (
  lastStatusChangeTimes: Ref.Ref<ReadonlyMap<EntityIdValueObject, number>>,
  updatedSession: SessionEntity
) {
  const statusChangeTimes = yield* Ref.get(lastStatusChangeTimes);
  const isTurnEnd = yield* isNewTurnEnd(statusChangeTimes, updatedSession);
  const statusChangedAt =
    updatedSession.statusChangedAt === undefined ? 0 : DateTime.toEpochMillis(updatedSession.statusChangedAt);
  yield* Ref.set(lastStatusChangeTimes, new Map(statusChangeTimes).set(updatedSession.id, statusChangedAt));
  if (isTurnEnd) yield* Effect.withTracerEnabled(refreshSessionPullRequest(updatedSession), true);
});

// An agent that just finished a turn may have pushed its branch or opened its pull request; only that is traced.
export const startPullRequestRefreshOnTurnEnd = Effect.fn("PullRequestService.startPullRequestRefreshOnTurnEnd")(
  function* () {
    const sessionRepository = yield* ISessionRepository;
    const lastStatusChangeTimes = yield* Ref.make<ReadonlyMap<EntityIdValueObject, number>>(new Map());
    const updatedSessions = Stream.filterMap(sessionRepository.entityChanges, (sessionChange) =>
      sessionChange.kind === ENTITY_CHANGE_KINDS.UPDATED ? Result.succeed(sessionChange.entity) : Result.failVoid
    );

    yield* Effect.forkScoped(
      Stream.runForEach(updatedSessions, (updatedSession) =>
        Effect.withTracerEnabled(refreshAfterTurnEnd(lastStatusChangeTimes, updatedSession), false)
      )
    );
  }
);

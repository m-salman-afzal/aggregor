import {toBranchPullRequest} from "@infraServices/gitHubCli/gitHubCli.transformer.ts";
import {
  GitHubCliNotFoundError,
  GitHubCliSignedOutError,
  IGitHubCliInfraService,
  PullRequestNotFoundError
} from "@interfaces/gitHubCli.infraService.interface.ts";
import {GITHUB_CLI, GITHUB_PULL_REQUESTS_EXTENSION} from "@pkg/constants/src/gitHubCli.constant.ts";
import {EXIT_CODES} from "@pkg/constants/src/process.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {streamVsCodeEvent} from "@pkg/vscode/src/vscode.utils.ts";
import {Array, Clock, Effect, Layer, Match, PubSub, Queue, Ref, Result, Stream} from "effect";
import {ChildProcess} from "effect/process";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";

import type {
  BranchPullRequest,
  GitHubCliProblem,
  PullRequestBranch
} from "@interfaces/gitHubCli.infraService.interface.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

interface CachedPullRequest {
  readonly pullRequestBranch: PullRequestBranch;
  readonly pullRequestResult: Result.Result<BranchPullRequest, PullRequestNotFoundError>;
}

interface GitHubCliDependencies {
  readonly cachedPullRequests: Ref.Ref<ReadonlyMap<string, CachedPullRequest>>;
  readonly childProcessSpawner: ChildProcessSpawner["Service"];
  readonly gitHubCliProblems: PubSub.PubSub<GitHubCliProblem>;
  readonly lastRefreshedAt: Ref.Ref<number>;
  readonly pendingLookupKeys: Ref.Ref<ReadonlySet<string>>;
  readonly pullRequestChanges: PubSub.PubSub<ProjectPathValueObject>;
  readonly pullRequestLookups: Queue.Queue<PullRequestBranch>;
  readonly reportedProblemTags: Ref.Ref<ReadonlySet<string>>;
  readonly vsCodeApi: VsCodeApi["Service"];
}

const toLookupKey = Effect.fn("GitHubCliInfraService.toLookupKey")(function* (pullRequestBranch: PullRequestBranch) {
  return `${pullRequestBranch.folderPath}\n${pullRequestBranch.branchName}`;
});

const runGitHubCli = Effect.fn("GitHubCliInfraService.runGitHubCli")(function* (
  childProcessSpawner: ChildProcessSpawner["Service"],
  pullRequestBranch: PullRequestBranch
) {
  const gitHubCliProcess = yield* childProcessSpawner.spawn(
    ChildProcess.make(
      GITHUB_CLI.COMMAND,
      ["pr", "view", pullRequestBranch.branchName, "--json", GITHUB_CLI.PULL_REQUEST_FIELDS],
      {cwd: pullRequestBranch.folderPath}
    )
  );
  const [stdout, stderr, exitCode] = yield* Effect.all(
    [
      Stream.mkString(Stream.decodeText(gitHubCliProcess.stdout)),
      Stream.mkString(Stream.decodeText(gitHubCliProcess.stderr)),
      gitHubCliProcess.exitCode
    ],
    {concurrency: "unbounded"}
  );

  return {exitCode, stderr, stdout};
}, Effect.scoped);

// Exit code 1 covers no pull request, no GitHub remote and no repository; stderr says which. A hung gh is killed.
const lookUpPullRequest = Effect.fn("GitHubCliInfraService.lookUpPullRequest")(
  function* (childProcessSpawner: ChildProcessSpawner["Service"], pullRequestBranch: PullRequestBranch) {
    yield* Effect.annotateCurrentSpan({
      branchName: pullRequestBranch.branchName,
      folderPath: pullRequestBranch.folderPath
    });
    const gitHubCliOutput = yield* runGitHubCli(childProcessSpawner, pullRequestBranch);
    yield* Effect.annotateCurrentSpan({exitCode: gitHubCliOutput.exitCode, stderr: gitHubCliOutput.stderr});
    if (gitHubCliOutput.exitCode === GITHUB_CLI.SIGNED_OUT_EXIT_CODE) return yield* GitHubCliSignedOutError.make();
    if (gitHubCliOutput.exitCode !== EXIT_CODES.SUCCESSFUL) return yield* PullRequestNotFoundError.make();

    return yield* toBranchPullRequest(gitHubCliOutput.stdout);
  },
  Effect.timeout(GITHUB_CLI.LOOKUP_TIMEOUT),
  Effect.catchTags({
    PlatformError: () => Effect.fail(GitHubCliNotFoundError.make()),
    SchemaError: () => Effect.fail(PullRequestNotFoundError.make()),
    TimeoutError: () => Effect.fail(PullRequestNotFoundError.make())
  })
);

const reportGitHubCliProblem = Effect.fn("GitHubCliInfraService.reportGitHubCliProblem")(function* (
  gitHubCliDependencies: GitHubCliDependencies,
  gitHubCliProblem: GitHubCliProblem
) {
  const reportedProblemTags = yield* Ref.get(gitHubCliDependencies.reportedProblemTags);
  if (reportedProblemTags.has(gitHubCliProblem._tag)) return;
  yield* Ref.set(gitHubCliDependencies.reportedProblemTags, new Set([...reportedProblemTags, gitHubCliProblem._tag]));
  yield* PubSub.publish(gitHubCliDependencies.gitHubCliProblems, gitHubCliProblem);
});

const toComparablePullRequest = Effect.fn("GitHubCliInfraService.toComparablePullRequest")(function* (
  cachedPullRequest: CachedPullRequest | undefined
) {
  if (cachedPullRequest === undefined) return "";

  return Result.match(cachedPullRequest.pullRequestResult, {
    onFailure: () => "",
    onSuccess: (pullRequest) => `${pullRequest.number}\n${pullRequest.state}\n${pullRequest.title}\n${pullRequest.url}`
  });
});

// Only a change redraws: a branch with no pull request before or after leaves its rows alone.
const storePullRequest = Effect.fn("GitHubCliInfraService.storePullRequest")(function* (
  gitHubCliDependencies: GitHubCliDependencies,
  cachedPullRequest: CachedPullRequest
) {
  const lookupKey = yield* toLookupKey(cachedPullRequest.pullRequestBranch);
  const cachedPullRequests = yield* Ref.get(gitHubCliDependencies.cachedPullRequests);
  const previousComparable = yield* toComparablePullRequest(cachedPullRequests.get(lookupKey));
  const nextComparable = yield* toComparablePullRequest(cachedPullRequest);
  yield* Ref.set(
    gitHubCliDependencies.cachedPullRequests,
    new Map(cachedPullRequests).set(lookupKey, cachedPullRequest)
  );
  yield* Ref.update(
    gitHubCliDependencies.pendingLookupKeys,
    (pendingLookupKeys) =>
      new Set(Array.filter([...pendingLookupKeys], (pendingLookupKey) => pendingLookupKey !== lookupKey))
  );
  if (previousComparable === nextComparable) return;

  yield* PubSub.publish(gitHubCliDependencies.pullRequestChanges, cachedPullRequest.pullRequestBranch.folderPath);
});

const fetchPullRequest = Effect.fn("GitHubCliInfraService.fetchPullRequest")(function* (
  gitHubCliDependencies: GitHubCliDependencies,
  pullRequestBranch: PullRequestBranch
) {
  const lookupResult = yield* Effect.result(
    lookUpPullRequest(gitHubCliDependencies.childProcessSpawner, pullRequestBranch)
  );
  if (Result.isFailure(lookupResult))
    yield* Match.valueTags(lookupResult.failure, {
      GitHubCliNotFoundError: (gitHubCliProblem) => reportGitHubCliProblem(gitHubCliDependencies, gitHubCliProblem),
      GitHubCliSignedOutError: (gitHubCliProblem) => reportGitHubCliProblem(gitHubCliDependencies, gitHubCliProblem),
      PullRequestNotFoundError: () => Effect.void
    });

  yield* storePullRequest(gitHubCliDependencies, {
    pullRequestBranch,
    pullRequestResult: Result.mapError(lookupResult, () => PullRequestNotFoundError.make())
  });
});

// A branch already waiting for its lookup isn't queued twice.
const refreshPullRequest = Effect.fn("GitHubCliInfraService.refreshPullRequest")(function* (
  gitHubCliDependencies: GitHubCliDependencies,
  pullRequestBranch: PullRequestBranch
) {
  const lookupKey = yield* toLookupKey(pullRequestBranch);
  const isPending = yield* Ref.modify(gitHubCliDependencies.pendingLookupKeys, (pendingLookupKeys) => [
    pendingLookupKeys.has(lookupKey),
    new Set([...pendingLookupKeys, lookupKey])
  ]);
  if (isPending) return;

  yield* Queue.offer(gitHubCliDependencies.pullRequestLookups, pullRequestBranch);
});

const findPullRequest = Effect.fn("GitHubCliInfraService.findPullRequest")(function* (
  gitHubCliDependencies: GitHubCliDependencies,
  pullRequestBranch: PullRequestBranch
) {
  const cachedPullRequests = yield* Ref.get(gitHubCliDependencies.cachedPullRequests);
  const lookupKey = yield* toLookupKey(pullRequestBranch);
  const cachedPullRequest = cachedPullRequests.get(lookupKey);
  if (cachedPullRequest !== undefined) return yield* Effect.fromResult(cachedPullRequest.pullRequestResult);
  yield* refreshPullRequest(gitHubCliDependencies, pullRequestBranch);

  return yield* PullRequestNotFoundError.make();
});

// Every branch looked up so far, at most once in GITHUB_CLI.REFRESH_INTERVAL_MS unless forced.
const refreshAllPullRequests = Effect.fn("GitHubCliInfraService.refreshAllPullRequests")(function* (
  gitHubCliDependencies: GitHubCliDependencies,
  isForced: boolean
) {
  const refreshStartedAt = yield* Clock.currentTimeMillis;
  const lastRefreshedAt = yield* Ref.getAndSet(gitHubCliDependencies.lastRefreshedAt, refreshStartedAt);
  if (!isForced && refreshStartedAt - lastRefreshedAt < GITHUB_CLI.REFRESH_INTERVAL_MS) return;
  if (isForced) yield* Ref.set(gitHubCliDependencies.reportedProblemTags, new Set());
  const cachedPullRequests = yield* Ref.get(gitHubCliDependencies.cachedPullRequests);

  yield* Effect.forEach(cachedPullRequests.values(), (cachedPullRequest) =>
    refreshPullRequest(gitHubCliDependencies, cachedPullRequest.pullRequestBranch)
  );
});

// Its close, once the user is done with it, looks every branch up again.
const openGitHubCliTerminal = Effect.fn("GitHubCliInfraService.openGitHubCliTerminal")(function* (
  vsCodeApi: VsCodeApi["Service"],
  commandLine: string
) {
  yield* Effect.annotateCurrentSpan({commandLine});

  yield* Effect.sync(() => {
    vsCodeApi.window
      .createTerminal({
        name: GITHUB_CLI.TERMINAL_NAME,
        shellArgs: ["-c", `${commandLine}${GITHUB_CLI.TERMINAL_CLOSE_PROMPT}`],
        shellPath: GITHUB_CLI.TERMINAL_SHELL
      })
      .show();
  });
});

const openPullRequestInBrowser = Effect.fn("GitHubCliInfraService.openPullRequestInBrowser")(function* (
  vsCodeApi: VsCodeApi["Service"],
  pullRequest: BranchPullRequest
) {
  yield* Effect.promise(() => vsCodeApi.env.openExternal(vsCodeApi.Uri.parse(pullRequest.url)));
});

const openPullRequestInVsCode = Effect.fn("GitHubCliInfraService.openPullRequestInVsCode")(function* (
  vsCodeApi: VsCodeApi["Service"],
  pullRequest: BranchPullRequest
) {
  const pullRequestsExtension = vsCodeApi.extensions.getExtension(GITHUB_PULL_REQUESTS_EXTENSION.ID);
  yield* Effect.annotateCurrentSpan({hasPullRequestsExtension: pullRequestsExtension !== undefined});
  if (pullRequestsExtension === undefined) return yield* openPullRequestInBrowser(vsCodeApi, pullRequest);
  const pullRequestLink = vsCodeApi.Uri.from({
    authority: GITHUB_PULL_REQUESTS_EXTENSION.ID,
    path: GITHUB_PULL_REQUESTS_EXTENSION.OPEN_PULL_REQUEST_PATH,
    query: new URLSearchParams({
      [GITHUB_PULL_REQUESTS_EXTENSION.PULL_REQUEST_URL_PARAMETER]: pullRequest.url
    }).toString(),
    scheme: vsCodeApi.env.uriScheme
  });

  return yield* Effect.promise(() => vsCodeApi.env.openExternal(pullRequestLink));
});

// A focus back from the browser, where a pull request may have opened or merged, or gh's own terminal closing.
const watchRefreshHints = Effect.fn("GitHubCliInfraService.watchRefreshHints")(function* (
  gitHubCliDependencies: GitHubCliDependencies
) {
  const windowStateChanges = yield* streamVsCodeEvent(gitHubCliDependencies.vsCodeApi.window.onDidChangeWindowState);
  const closedTerminals = yield* streamVsCodeEvent(gitHubCliDependencies.vsCodeApi.window.onDidCloseTerminal);
  const refreshHints = Stream.merge(
    Stream.as(
      Stream.filter(windowStateChanges, (windowState) => windowState.focused),
      false
    ),
    Stream.as(
      Stream.filter(closedTerminals, (closedTerminal) => closedTerminal.name === GITHUB_CLI.TERMINAL_NAME),
      true
    )
  );

  yield* Stream.runForEach(refreshHints, (isForced) => refreshAllPullRequests(gitHubCliDependencies, isForced));
});

// In the layer's own fiber, a few at a time, so reading the list never waits on the network.
const runPullRequestLookups = Effect.fn("GitHubCliInfraService.runPullRequestLookups")(function* (
  gitHubCliDependencies: GitHubCliDependencies
) {
  yield* Stream.runDrain(
    Stream.mapEffect(
      Stream.fromQueue(gitHubCliDependencies.pullRequestLookups),
      (pullRequestBranch) => fetchPullRequest(gitHubCliDependencies, pullRequestBranch),
      {concurrency: GITHUB_CLI.LOOKUP_CONCURRENCY}
    )
  );
});

const makeGitHubCliDependencies = Effect.fn("GitHubCliInfraService.makeGitHubCliDependencies")(function* () {
  const gitHubCliDependencies: GitHubCliDependencies = {
    cachedPullRequests: yield* Ref.make<ReadonlyMap<string, CachedPullRequest>>(new Map()),
    childProcessSpawner: yield* ChildProcessSpawner,
    gitHubCliProblems: yield* PubSub.unbounded<GitHubCliProblem>(),
    lastRefreshedAt: yield* Ref.make(0),
    pendingLookupKeys: yield* Ref.make<ReadonlySet<string>>(new Set()),
    pullRequestChanges: yield* PubSub.unbounded<ProjectPathValueObject>(),
    pullRequestLookups: yield* Queue.unbounded<PullRequestBranch>(),
    reportedProblemTags: yield* Ref.make<ReadonlySet<string>>(new Set()),
    vsCodeApi: yield* VsCodeApi
  };

  return gitHubCliDependencies;
});

const makeGitHubCliInfraService = Effect.fn("GitHubCliInfraService.make")(function* () {
  const gitHubCliDependencies = yield* makeGitHubCliDependencies();
  yield* Effect.forkScoped(runPullRequestLookups(gitHubCliDependencies));
  yield* Effect.forkScoped(watchRefreshHints(gitHubCliDependencies));

  return {
    findPullRequest: (pullRequestBranch: PullRequestBranch) =>
      findPullRequest(gitHubCliDependencies, pullRequestBranch),
    gitHubCliProblems: Stream.fromPubSub(gitHubCliDependencies.gitHubCliProblems),
    openGitHubCliTerminal: (commandLine: string) => openGitHubCliTerminal(gitHubCliDependencies.vsCodeApi, commandLine),
    openPullRequestInBrowser: (pullRequest: BranchPullRequest) =>
      openPullRequestInBrowser(gitHubCliDependencies.vsCodeApi, pullRequest),
    openPullRequestInVsCode: (pullRequest: BranchPullRequest) =>
      openPullRequestInVsCode(gitHubCliDependencies.vsCodeApi, pullRequest),
    pullRequestChangedFolderPaths: Stream.fromPubSub(gitHubCliDependencies.pullRequestChanges),
    refreshPullRequest: (pullRequestBranch: PullRequestBranch) =>
      refreshPullRequest(gitHubCliDependencies, pullRequestBranch)
  };
});

export const GitHubCliInfraService = Layer.effect(IGitHubCliInfraService, makeGitHubCliInfraService());

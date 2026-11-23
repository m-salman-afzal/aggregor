import {NodeServices} from "@effect/platform-node";
import {Array, Clock, Context, Effect, Layer, Match, PubSub, Queue, Ref, Result, Stream} from "effect";
import {ChildProcess} from "effect/process";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";

import {GitHubCliTransformer} from "@/infraServices/gitHubCli/gitHubCli.transformer.ts";
import {IGitHubCliInfraService, IGitHubCliInfraServiceErrors} from "@/interfaces/gitHubCli.infraService.interface.ts";
import {GITHUB_CLI, GITHUB_PULL_REQUESTS_EXTENSION} from "@pkg/constants/src/gitHubCli.constant.ts";
import {EXIT_CODES} from "@pkg/constants/src/process.constant.ts";
import {SETUP_TERMINAL} from "@pkg/constants/src/requiredTools.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";

import type {BranchPullRequest, PullRequestLookup} from "@/interfaces/gitHubCli.infraService.interface.ts";
import type {ProjectPathValueObject} from "@/valueObjects/projectPath.valueObject.ts";

interface CachedPullRequest {
  readonly pullRequestLookup: PullRequestLookup;
  readonly pullRequestResult: Result.Result<
    BranchPullRequest,
    IGitHubCliInfraServiceErrors["PullRequestNotFoundError"]
  >;
}

export class GitHubCliInfraService extends Context.Service<GitHubCliInfraService>()(
  "aggregor-app/infrastructure/services/gitHubCli/gitHubCli.infraService/GitHubCliInfraService",
  {
    make: Effect.fn("GitHubCliInfraService.make")(function* () {
      const childProcessSpawner = yield* ChildProcessSpawner;
      const vsCodeApi = yield* VsCodeApi;
      const vscodeUtils = yield* VscodeUtils;
      const gitHubCliTransformer = yield* GitHubCliTransformer;
      const cachedPullRequests = yield* Ref.make<ReadonlyMap<string, CachedPullRequest>>(new Map());
      const gitHubCliSignedOutProblems =
        yield* PubSub.unbounded<IGitHubCliInfraServiceErrors["GitHubCliSignedOutError"]>();
      const isSignedOutReported = yield* Ref.make(false);
      const lastRefreshedAt = yield* Ref.make(0);
      const pendingLookupKeys = yield* Ref.make<ReadonlySet<string>>(new Set());
      const pullRequestChanges = yield* PubSub.unbounded<ProjectPathValueObject>();
      const pullRequestLookups = yield* Queue.unbounded<PullRequestLookup>();

      const makePullRequestLookupKey = Effect.fn("GitHubCliInfraService.makePullRequestLookupKey")(function* (
        pullRequestLookup: PullRequestLookup
      ) {
        return `${pullRequestLookup.folderPath}\n${pullRequestLookup.pullRequestReference}`;
      });

      const runGitHubCli = Effect.fn("GitHubCliInfraService.runGitHubCli")(function* (
        gitHubCliArguments: readonly string[],
        folderPath: ProjectPathValueObject
      ) {
        const gitHubCliProcess = yield* childProcessSpawner.spawn(
          ChildProcess.make(GITHUB_CLI.COMMAND, gitHubCliArguments, {cwd: folderPath})
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

      // Exit code 1 covers no pull request, no GitHub remote and no repository; stderr says which.
      const lookUpPullRequest = Effect.fn("GitHubCliInfraService.lookUpPullRequest")(
        function* (pullRequestLookup: PullRequestLookup) {
          yield* Effect.annotateCurrentSpan({
            folderPath: pullRequestLookup.folderPath,
            pullRequestReference: pullRequestLookup.pullRequestReference
          });
          const gitHubCliOutput = yield* runGitHubCli(
            ["pr", "view", pullRequestLookup.pullRequestReference, "--json", GITHUB_CLI.PULL_REQUEST_FIELDS],
            pullRequestLookup.folderPath
          );
          yield* Effect.annotateCurrentSpan({exitCode: gitHubCliOutput.exitCode, stderr: gitHubCliOutput.stderr});
          if (gitHubCliOutput.exitCode === GITHUB_CLI.SIGNED_OUT_EXIT_CODE)
            return yield* IGitHubCliInfraServiceErrors.GitHubCliSignedOutError.make();
          if (gitHubCliOutput.exitCode !== EXIT_CODES.SUCCESSFUL)
            return yield* IGitHubCliInfraServiceErrors.PullRequestNotFoundError.make();

          return yield* gitHubCliTransformer.decodeBranchPullRequest(gitHubCliOutput.stdout);
        },
        Effect.timeout(GITHUB_CLI.LOOKUP_TIMEOUT),
        Effect.catchTags({
          PlatformError: () => Effect.fail(IGitHubCliInfraServiceErrors.PullRequestNotFoundError.make()),
          SchemaError: () => Effect.fail(IGitHubCliInfraServiceErrors.PullRequestNotFoundError.make()),
          TimeoutError: () => Effect.fail(IGitHubCliInfraServiceErrors.PullRequestNotFoundError.make())
        })
      );

      const listPullRequests = Effect.fn("GitHubCliInfraService.listPullRequests")(
        function* (folderPath: ProjectPathValueObject) {
          yield* Effect.annotateCurrentSpan({folderPath});
          const gitHubCliOutput = yield* runGitHubCli(
            [
              "pr",
              "list",
              "--state",
              "all",
              "--limit",
              GITHUB_CLI.LISTED_PULL_REQUEST_LIMIT,
              "--json",
              GITHUB_CLI.LISTED_PULL_REQUEST_FIELDS
            ],
            folderPath
          );
          yield* Effect.annotateCurrentSpan({exitCode: gitHubCliOutput.exitCode, stderr: gitHubCliOutput.stderr});
          if (gitHubCliOutput.exitCode === GITHUB_CLI.SIGNED_OUT_EXIT_CODE)
            return yield* IGitHubCliInfraServiceErrors.GitHubCliSignedOutError.make();
          if (gitHubCliOutput.exitCode !== EXIT_CODES.SUCCESSFUL)
            return yield* IGitHubCliInfraServiceErrors.PullRequestListFailedError.make();

          return yield* gitHubCliTransformer.decodeListedPullRequests(gitHubCliOutput.stdout);
        },
        Effect.timeout(GITHUB_CLI.LOOKUP_TIMEOUT),
        Effect.catchTags({
          PlatformError: () => Effect.fail(IGitHubCliInfraServiceErrors.PullRequestListFailedError.make()),
          SchemaError: () => Effect.fail(IGitHubCliInfraServiceErrors.PullRequestListFailedError.make()),
          TimeoutError: () => Effect.fail(IGitHubCliInfraServiceErrors.PullRequestListFailedError.make())
        })
      );

      const reportSignedOut = Effect.fn("GitHubCliInfraService.reportSignedOut")(function* (
        gitHubCliSignedOutError: IGitHubCliInfraServiceErrors["GitHubCliSignedOutError"]
      ) {
        const wasReported = yield* Ref.getAndSet(isSignedOutReported, true);
        if (wasReported) return;
        yield* PubSub.publish(gitHubCliSignedOutProblems, gitHubCliSignedOutError);
      });

      const makeComparablePullRequestText = Effect.fn("GitHubCliInfraService.makeComparablePullRequestText")(function* (
        cachedPullRequest: CachedPullRequest | undefined
      ) {
        if (cachedPullRequest === undefined) return "";

        return Result.match(cachedPullRequest.pullRequestResult, {
          onFailure: () => "",
          onSuccess: (pullRequest) =>
            `${pullRequest.number}\n${pullRequest.state}\n${pullRequest.title}\n${pullRequest.url}`
        });
      });

      const storePullRequest = Effect.fn("GitHubCliInfraService.storePullRequest")(function* (
        cachedPullRequest: CachedPullRequest
      ) {
        const lookupKey = yield* makePullRequestLookupKey(cachedPullRequest.pullRequestLookup);
        const cachedPullRequestsByLookupKey = yield* Ref.get(cachedPullRequests);
        const previousComparable = yield* makeComparablePullRequestText(cachedPullRequestsByLookupKey.get(lookupKey));
        const nextComparable = yield* makeComparablePullRequestText(cachedPullRequest);
        yield* Ref.set(cachedPullRequests, new Map(cachedPullRequestsByLookupKey).set(lookupKey, cachedPullRequest));
        yield* Ref.update(
          pendingLookupKeys,
          (currentPendingLookupKeys) =>
            new Set(Array.filter([...currentPendingLookupKeys], (pendingLookupKey) => pendingLookupKey !== lookupKey))
        );
        if (previousComparable === nextComparable) return;

        yield* PubSub.publish(pullRequestChanges, cachedPullRequest.pullRequestLookup.folderPath);
      });

      const fetchPullRequest = Effect.fn("GitHubCliInfraService.fetchPullRequest")(function* (
        pullRequestLookup: PullRequestLookup
      ) {
        const lookupResult = yield* Effect.result(lookUpPullRequest(pullRequestLookup));
        if (Result.isFailure(lookupResult))
          yield* Match.valueTags(lookupResult.failure, {
            GitHubCliSignedOutError: (gitHubCliSignedOutError) => reportSignedOut(gitHubCliSignedOutError),
            PullRequestNotFoundError: () => Effect.void
          });

        yield* storePullRequest({
          pullRequestLookup,
          pullRequestResult: Result.mapError(lookupResult, () =>
            IGitHubCliInfraServiceErrors.PullRequestNotFoundError.make()
          )
        });
      });

      const refreshPullRequest = Effect.fn("GitHubCliInfraService.refreshPullRequest")(function* (
        pullRequestLookup: PullRequestLookup
      ) {
        const lookupKey = yield* makePullRequestLookupKey(pullRequestLookup);
        const isPending = yield* Ref.modify(pendingLookupKeys, (currentPendingLookupKeys) => [
          currentPendingLookupKeys.has(lookupKey),
          new Set([...currentPendingLookupKeys, lookupKey])
        ]);
        if (isPending) return;

        yield* Queue.offer(pullRequestLookups, pullRequestLookup);
      });

      const findPullRequest = Effect.fn("GitHubCliInfraService.findPullRequest")(function* (
        pullRequestLookup: PullRequestLookup
      ) {
        const cachedPullRequestsByLookupKey = yield* Ref.get(cachedPullRequests);
        const lookupKey = yield* makePullRequestLookupKey(pullRequestLookup);
        const cachedPullRequest = cachedPullRequestsByLookupKey.get(lookupKey);
        if (cachedPullRequest !== undefined) return yield* Effect.fromResult(cachedPullRequest.pullRequestResult);
        yield* refreshPullRequest(pullRequestLookup);

        return yield* IGitHubCliInfraServiceErrors.PullRequestNotFoundError.make();
      });

      const refreshAllPullRequests = Effect.fn("GitHubCliInfraService.refreshAllPullRequests")(function* (
        isForced: boolean
      ) {
        const refreshStartedAt = yield* Clock.currentTimeMillis;
        const previousRefreshedAt = yield* Ref.get(lastRefreshedAt);
        if (!isForced && refreshStartedAt - previousRefreshedAt < GITHUB_CLI.REFRESH_INTERVAL_MS) return;
        yield* Ref.set(lastRefreshedAt, refreshStartedAt);
        if (isForced) yield* Ref.set(isSignedOutReported, false);
        const cachedPullRequestsByLookupKey = yield* Ref.get(cachedPullRequests);

        yield* Effect.forEach(cachedPullRequestsByLookupKey.values(), (cachedPullRequest) =>
          refreshPullRequest(cachedPullRequest.pullRequestLookup)
        );
      });

      const openPullRequestInBrowser = Effect.fn("GitHubCliInfraService.openPullRequestInBrowser")(function* (
        pullRequest: BranchPullRequest
      ) {
        yield* Effect.promise(() => vsCodeApi.env.openExternal(vsCodeApi.Uri.parse(pullRequest.url)));
      });

      const openPullRequestInVsCode = Effect.fn("GitHubCliInfraService.openPullRequestInVsCode")(function* (
        pullRequest: BranchPullRequest
      ) {
        const pullRequestsExtension = vsCodeApi.extensions.getExtension(GITHUB_PULL_REQUESTS_EXTENSION.ID);
        yield* Effect.annotateCurrentSpan({hasPullRequestsExtension: pullRequestsExtension !== undefined});
        if (pullRequestsExtension === undefined) return yield* openPullRequestInBrowser(pullRequest);
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

      const watchRefreshHints = Effect.fn("GitHubCliInfraService.watchRefreshHints")(function* () {
        const windowStateChanges = yield* vscodeUtils.streamVsCodeEvent(vsCodeApi.window.onDidChangeWindowState);
        const closedTerminals = yield* vscodeUtils.streamVsCodeEvent(vsCodeApi.window.onDidCloseTerminal);
        const refreshHints = Stream.merge(
          Stream.as(
            Stream.filter(windowStateChanges, (windowState) => windowState.focused),
            false
          ),
          Stream.as(
            Stream.filter(closedTerminals, (closedTerminal) => closedTerminal.name === SETUP_TERMINAL.NAME),
            true
          )
        );

        yield* Stream.runForEach(refreshHints, (isForced) => refreshAllPullRequests(isForced));
      });

      const runPullRequestLookups = Effect.fn("GitHubCliInfraService.runPullRequestLookups")(function* () {
        yield* Stream.runDrain(
          Stream.mapEffect(
            Stream.fromQueue(pullRequestLookups),
            (pullRequestLookup) => fetchPullRequest(pullRequestLookup),
            {concurrency: GITHUB_CLI.LOOKUP_CONCURRENCY}
          )
        );
      });

      yield* Effect.forkScoped(runPullRequestLookups());
      yield* Effect.forkScoped(watchRefreshHints());

      return {
        findPullRequest,
        gitHubCliSignedOutProblems: Stream.fromPubSub(gitHubCliSignedOutProblems),
        listPullRequests,
        openPullRequestInBrowser,
        openPullRequestInVsCode,
        pullRequestChangedFolderPaths: Stream.fromPubSub(pullRequestChanges),
        refreshPullRequest
      };
    })
  }
) {
  public static readonly layer = Layer.effect(IGitHubCliInfraService, this.make()).pipe(
    Layer.provide([GitHubCliTransformer.layer, NodeServices.layer])
  );
}

import {Array, Context, Effect, Layer, Result, Schema} from "effect";

import {IGitInfraService, IGitInfraServiceErrors} from "@/interfaces/git.infraService.interface.ts";
import {GIT_EXTENSION} from "@pkg/constants/src/git.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";

import type {ProjectPathValueObject} from "@/valueObjects/projectPath.valueObject.ts";
import type {API, Branch, GitExtension, Repository} from "@pkg/typings/src/git.js";

class GitInfraServiceErrors extends TaggedErrors({
  GitRepositoryOpenFailedError: {cause: Schema.Unknown}
}) {}

export class GitInfraService extends Context.Service<GitInfraService>()(
  "aggregor-app/infrastructure/services/vscode/git.infraService/GitInfraService",
  {
    make: Effect.fn("GitInfraService.make")(function* () {
      const vsCodeApi = yield* VsCodeApi;

      const getGitApi = Effect.fn("GitInfraService.getGitApi")(function* () {
        const gitExtension = yield* Effect.fromResult(
          Result.fromNullishOr(vsCodeApi.extensions.getExtension<GitExtension>(GIT_EXTENSION.ID), () =>
            IGitInfraServiceErrors.GitExtensionUnavailableError.make()
          )
        );
        // An open Sessions view can activate us before git, which has no exports until it is active; activate() returns them.
        const gitExports = yield* Effect.tryPromise({
          catch: () => IGitInfraServiceErrors.GitExtensionUnavailableError.make(),
          try: () => gitExtension.activate()
        });

        // getAPI throws when git is turned off in the settings.
        return yield* Effect.try({
          catch: () => IGitInfraServiceErrors.GitExtensionDisabledError.make(),
          try: () => gitExports.getAPI(GIT_EXTENSION.API_VERSION)
        });
      });

      const findGitRepository = Effect.fn("GitInfraService.findGitRepository")(function* (
        gitApi: API,
        projectPath: ProjectPathValueObject
      ) {
        return yield* Effect.fromResult(
          Result.fromNullishOr(gitApi.getRepository(vsCodeApi.Uri.file(projectPath)), () =>
            IGitInfraServiceErrors.GitRepositoryUnavailableError.make()
          )
        );
      });

      const getGitRepository = Effect.fn("GitInfraService.getGitRepository")(function* (
        projectPath: ProjectPathValueObject
      ) {
        const gitApi = yield* getGitApi();

        return yield* findGitRepository(gitApi, projectPath);
      });

      const getRepositoryWithStagedChanges = Effect.fn("GitInfraService.getRepositoryWithStagedChanges")(function* (
        projectPath: ProjectPathValueObject
      ) {
        return yield* Effect.filterOrFail(
          getGitRepository(projectPath),
          (repository) => repository.state.indexChanges.length > 0,
          () => IGitInfraServiceErrors.NothingStagedError.make()
        );
      });

      const readStagedDiff = Effect.fn("GitInfraService.readStagedDiff")(function* (repository: Repository) {
        return yield* Effect.tryPromise({
          catch: () => IGitInfraServiceErrors.GitDiffError.make(),
          try: () => repository.diff(true)
        });
      });

      const getStagedDiff = Effect.fn("GitInfraService.getStagedDiff")(function* (projectPath: ProjectPathValueObject) {
        const repository = yield* getRepositoryWithStagedChanges(projectPath);

        return yield* readStagedDiff(repository);
      });

      const setCommitMessageInput = Effect.fn("GitInfraService.setCommitMessageInput")(function* (
        projectPath: ProjectPathValueObject,
        commitMessage: string
      ) {
        const repository = yield* getGitRepository(projectPath);

        yield* Effect.sync(() => {
          repository.inputBox.value = commitMessage;
        });
      });

      const commit = Effect.fn("GitInfraService.commit")(function* (
        projectPath: ProjectPathValueObject,
        commitMessage: string
      ) {
        const repository = yield* getGitRepository(projectPath);

        yield* Effect.tryPromise({
          catch: (cause) => IGitInfraServiceErrors.CommitFailedError.make({cause}),
          try: () => repository.commit(commitMessage)
        });
      });

      const findPublishRemoteName = Effect.fn("GitInfraService.findPublishRemoteName")(function* (
        repository: Repository
      ) {
        const remoteNames = Array.map(repository.state.remotes, (remote) => remote.name);
        if (remoteNames.includes(GIT_EXTENSION.PUBLISH_REMOTE_NAME)) return GIT_EXTENSION.PUBLISH_REMOTE_NAME;
        const [onlyRemoteName, ...otherRemoteNames] = remoteNames;
        if (onlyRemoteName === undefined || otherRemoteNames.length > 0)
          return yield* IGitInfraServiceErrors.PushRemoteAmbiguousError.make({remoteNames});

        return onlyRemoteName;
      });

      const publishBranch = Effect.fn("GitInfraService.publishBranch")(function* (
        repository: Repository,
        headBranch: Branch | undefined
      ) {
        if (headBranch === undefined || headBranch.name === undefined)
          return yield* IGitInfraServiceErrors.DetachedHeadPushError.make();
        const branchName = headBranch.name;
        const remoteName = yield* findPublishRemoteName(repository);

        return yield* Effect.tryPromise({
          catch: (cause) => IGitInfraServiceErrors.PushFailedError.make({cause}),
          try: () => repository.push(remoteName, branchName, true)
        });
      });

      const push = Effect.fn("GitInfraService.push")(function* (projectPath: ProjectPathValueObject) {
        const repository = yield* getGitRepository(projectPath);
        const headBranch = repository.state.HEAD;
        const hasUpstream = headBranch !== undefined && headBranch.upstream !== undefined;
        yield* Effect.annotateCurrentSpan({hasUpstream, remoteCount: repository.state.remotes.length});
        if (!hasUpstream && repository.state.remotes.length === 0) return;
        if (!hasUpstream) {
          yield* publishBranch(repository, headBranch);

          return;
        }

        yield* Effect.tryPromise({
          catch: (cause) => IGitInfraServiceErrors.PushFailedError.make({cause}),
          try: () => repository.push()
        });
      });

      const openAndLoadRepository = Effect.fn("GitInfraService.openAndLoadRepository")(function* (
        gitApi: API,
        projectPath: ProjectPathValueObject
      ) {
        const repository = yield* Effect.tryPromise({
          catch: (cause) => GitInfraServiceErrors.GitRepositoryOpenFailedError.make({cause}),
          try: () => gitApi.openRepository(vsCodeApi.Uri.file(projectPath))
        });
        if (repository === null) return;

        yield* Effect.tryPromise({
          catch: (cause) => GitInfraServiceErrors.GitRepositoryOpenFailedError.make({cause}),
          try: () => repository.status()
        });
      });

      // Waits for the repository's first status, so Source Control can show its changes at once.
      const openInSourceControl = Effect.fn("GitInfraService.openInSourceControl")(
        function* (projectPath: ProjectPathValueObject) {
          const gitApi = yield* getGitApi();
          if (gitApi.getRepository(vsCodeApi.Uri.file(projectPath)) !== null) return;

          yield* openAndLoadRepository(gitApi, projectPath);
        },
        Effect.ignore({log: "Warn", message: "Could not open the project in Source Control"})
      );

      return {commit, getStagedDiff, openInSourceControl, push, setCommitMessageInput};
    })
  }
) {
  public static readonly layer = Layer.effect(IGitInfraService, this.make());
}

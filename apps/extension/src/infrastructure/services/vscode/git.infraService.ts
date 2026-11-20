import {IGitInfraService, IGitInfraServiceErrors} from "@interfaces/git.infraService.interface.ts";
import {GIT_EXTENSION} from "@pkg/constants/src/git.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {Context, Effect, Layer, Result, Schema} from "effect";

import type {API, GitExtension, Repository} from "@pkg/typings/src/git.js";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

class GitInfraServiceErrors extends TaggedErrors({
  GitRepositoryOpenFailedError: {cause: Schema.Unknown}
}) {}

export class GitInfraService extends Context.Service<GitInfraService>()(
  "aggregor-app/infrastructure/services/vscode/git.infraService/GitInfraService",
  {
    make: Effect.fn("make")(function* () {
      const vsCodeApi = yield* VsCodeApi;

      const getGitApi = Effect.fn("getGitApi")(function* () {
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

      const findGitRepository = Effect.fn("findGitRepository")(function* (
        gitApi: API,
        projectPath: ProjectPathValueObject
      ) {
        return yield* Effect.fromResult(
          Result.fromNullishOr(gitApi.getRepository(vsCodeApi.Uri.file(projectPath)), () =>
            IGitInfraServiceErrors.GitRepositoryUnavailableError.make()
          )
        );
      });

      const getGitRepository = Effect.fn("getGitRepository")(function* (projectPath: ProjectPathValueObject) {
        const gitApi = yield* getGitApi();

        return yield* findGitRepository(gitApi, projectPath);
      });

      const getRepositoryWithStagedChanges = Effect.fn("getRepositoryWithStagedChanges")(function* (
        projectPath: ProjectPathValueObject
      ) {
        return yield* Effect.filterOrFail(
          getGitRepository(projectPath),
          (repository) => repository.state.indexChanges.length > 0,
          () => IGitInfraServiceErrors.NothingStagedError.make()
        );
      });

      const readStagedDiff = Effect.fn("readStagedDiff")(function* (repository: Repository) {
        return yield* Effect.tryPromise({
          catch: () => IGitInfraServiceErrors.GitDiffError.make(),
          try: () => repository.diff(true)
        });
      });

      const getStagedDiff = Effect.fn("getStagedDiff")(function* (projectPath: ProjectPathValueObject) {
        const repository = yield* getRepositoryWithStagedChanges(projectPath);

        return yield* readStagedDiff(repository);
      });

      const setCommitMessageInput = Effect.fn("setCommitMessageInput")(function* (
        projectPath: ProjectPathValueObject,
        commitMessage: string
      ) {
        const repository = yield* getGitRepository(projectPath);

        yield* Effect.sync(() => {
          repository.inputBox.value = commitMessage;
        });
      });

      const commit = Effect.fn("commit")(function* (projectPath: ProjectPathValueObject, commitMessage: string) {
        const repository = yield* getGitRepository(projectPath);

        yield* Effect.tryPromise({
          catch: (cause) => IGitInfraServiceErrors.CommitFailedError.make({cause}),
          try: () => repository.commit(commitMessage)
        });
      });

      const openAndLoadRepository = Effect.fn("openAndLoadRepository")(function* (
        gitApi: API,
        projectPath: ProjectPathValueObject
      ) {
        const repository = yield* Effect.tryPromise({
          catch: (cause) => GitInfraServiceErrors.GitRepositoryOpenFailedError.make({cause}),
          try: () => gitApi.openRepository(vsCodeApi.Uri.file(projectPath))
        });
        // A folder that is not a git repository opens nothing.
        if (repository === null) return;

        yield* Effect.tryPromise({
          catch: (cause) => GitInfraServiceErrors.GitRepositoryOpenFailedError.make({cause}),
          try: () => repository.status()
        });
      });

      // Waits for the repository's first status, so Source Control can show its changes at once.
      const openInSourceControl = Effect.fn("openInSourceControl")(
        function* (projectPath: ProjectPathValueObject) {
          const gitApi = yield* getGitApi();
          if (gitApi.getRepository(vsCodeApi.Uri.file(projectPath)) !== null) return;

          yield* openAndLoadRepository(gitApi, projectPath);
        },
        Effect.ignore({log: "Warn", message: "Could not open the project in Source Control"})
      );

      return {commit, getStagedDiff, openInSourceControl, setCommitMessageInput};
    })
  }
) {
  public static readonly layer = Layer.effect(IGitInfraService, ownSpans("GitInfraService", this.make()));
}

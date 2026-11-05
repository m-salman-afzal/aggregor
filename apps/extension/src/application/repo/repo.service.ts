import {PromptClient} from "@/application/clients/prompt.client.ts";
import {WorkspaceClient} from "@/application/clients/workspace.client.ts";
import {NoRepo} from "@/application/errors/repo.error.ts";
import {showErrorInBackground} from "@/application/utils/error.utils.ts";
import {Repo} from "@/domain/entities/repo/repo.entity.ts";
import {RepoRepository} from "@/domain/entities/repo/repo.repository.ts";
import {REPO_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Match, Result, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {ReposCorrupt, ReposSaveFailed} from "@/domain/errors/repo.error.ts";

const showRepoRepositoryError = Effect.fn("showRepoRepositoryError")(function* (
  repoRepositoryError: ReposCorrupt | ReposSaveFailed
) {
  yield* showErrorInBackground(
    Match.valueTags(repoRepositoryError, {
      ReposCorrupt: () => REPO_MESSAGES.UNREADABLE,
      ReposSaveFailed: () => REPO_MESSAGES.SAVE_FAILED
    })
  );
});

// This window's repos: its workspace folders, then the added paths that are not also one of them.
export const listRepos = Effect.fn("listRepos")(function* () {
  const {addedRepoPaths} = yield* RepoRepository;
  const path = yield* Path;
  const workspaceFolderRepos = yield* WorkspaceClient.use((workspaceClient) =>
    workspaceClient.listWorkspaceFolderRepos()
  );
  const workspaceFolderPaths = new Set(workspaceFolderRepos.map((repo) => repo.path));
  const addedRepos = (yield* SubscriptionRef.get(addedRepoPaths))
    .filter((addedRepoPath) => !workspaceFolderPaths.has(addedRepoPath))
    .map((addedRepoPath) => new Repo({added: true, name: path.basename(addedRepoPath), path: addedRepoPath}));

  return [...workspaceFolderRepos, ...addedRepos];
});

// Asks only when the window has more than one repo.
export const pickRepo = Effect.fn("pickRepo")(function* () {
  const repos = yield* listRepos();
  if (repos.length > 1) return yield* PromptClient.use((promptClient) => promptClient.pickRepo(repos));

  return yield* Effect.fromResult(Result.fromNullishOr(repos[0], () => new NoRepo()));
});

// ponytail: any folder counts as a repo, no git check. Worktree mode (M3) is where a non-git folder would first break.
export const addRepo = Effect.fn("addRepo")(
  function* () {
    const {modifyAddedRepoPaths} = yield* RepoRepository;
    const pickedFolderPaths = yield* PromptClient.use((promptClient) => promptClient.pickRepoFolderPaths());

    yield* modifyAddedRepoPaths((storedAddedRepoPaths) => [
      ...new Set([...storedAddedRepoPaths, ...pickedFolderPaths])
    ]);
  },
  Effect.catchTag("FolderPickCancelled", () => Effect.void),
  Effect.catch(showRepoRepositoryError)
);

// Its sessions stay saved and their open tabs keep running; adding the repo again lists them again.
export const removeRepo = Effect.fn("removeRepo")(function* (repo: Repo) {
  const {modifyAddedRepoPaths} = yield* RepoRepository;
  yield* modifyAddedRepoPaths((storedAddedRepoPaths) =>
    storedAddedRepoPaths.filter((addedRepoPath) => addedRepoPath !== repo.path)
  );
}, Effect.catch(showRepoRepositoryError));

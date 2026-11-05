import {Repo} from "@/domain/entities/repo/repo.entity.ts";
import {RepoRepository} from "@/domain/entities/repo/repo.repository.ts";
import {RepoPathSchema} from "@/domain/value-objects/repo-path.value-object.ts";
import {FolderPickCancelled, NoRepo, RepoPickCancelled} from "@/errors/repo.error.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {showErrorInBackground} from "@/services/error.utils.ts";
import {ACTIONS, REPO_LABELS, REPO_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Match, Result, SubscriptionRef, UndefinedOr} from "effect";
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
  const {workspace} = yield* VsCodeService;
  const {addedRepoPaths} = yield* RepoRepository;
  const path = yield* Path;
  const workspaceFolderRepos = UndefinedOr.match(workspace.workspaceFolders, {
    onDefined: (workspaceFolders) =>
      workspaceFolders.map(
        (workspaceFolder) =>
          new Repo({added: false, name: workspaceFolder.name, path: RepoPathSchema.make(workspaceFolder.uri.fsPath)})
      ),
    onUndefined: (): Repo[] => []
  });
  const workspaceFolderPaths = new Set(workspaceFolderRepos.map((repo) => repo.path));
  const addedRepos = (yield* SubscriptionRef.get(addedRepoPaths))
    .filter((addedRepoPath) => !workspaceFolderPaths.has(addedRepoPath))
    .map((addedRepoPath) => new Repo({added: true, name: path.basename(addedRepoPath), path: addedRepoPath}));

  return [...workspaceFolderRepos, ...addedRepos];
});

const showRepoQuickPick = Effect.fn("showRepoQuickPick")(function* (repos: readonly Repo[]) {
  const {window} = yield* VsCodeService;
  const pickedItem = yield* Effect.promise(async () =>
    window.showQuickPick(
      repos.map((repo) => ({description: repo.path, label: repo.name, repo})),
      {placeHolder: REPO_LABELS.PICK}
    )
  );
  const {repo: pickedRepo} = yield* Effect.fromResult(Result.fromNullishOr(pickedItem, () => new RepoPickCancelled()));

  return pickedRepo;
});

// Asks only when the window has more than one repo.
export const pickRepo = Effect.fn("pickRepo")(function* () {
  const repos = yield* listRepos();
  if (repos.length > 1) return yield* showRepoQuickPick(repos);

  return yield* Effect.fromResult(Result.fromNullishOr(repos[0], () => new NoRepo()));
});

const pickFolderPaths = Effect.fn("pickFolderPaths")(function* () {
  const {window} = yield* VsCodeService;
  const pickedFolderUris = yield* Effect.promise(async () =>
    window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: true,
      openLabel: ACTIONS.ADD_REPO
    })
  );

  const confirmedFolderUris = yield* Effect.fromResult(
    Result.fromNullishOr(pickedFolderUris, () => new FolderPickCancelled())
  );

  return confirmedFolderUris.map((folderUri) => RepoPathSchema.make(folderUri.fsPath));
});

// ponytail: any folder counts as a repo, no git check. Worktree mode (M3) is where a non-git folder would first break.
export const addRepo = Effect.fn("addRepo")(
  function* () {
    const {modifyAddedRepoPaths} = yield* RepoRepository;
    const pickedFolderPaths = yield* pickFolderPaths();

    yield* modifyAddedRepoPaths((storedAddedRepoPaths) => [
      ...new Set([...storedAddedRepoPaths, ...pickedFolderPaths])
    ]);
  },
  Effect.catchTag("FolderPickCancelled", () => Effect.void),
  Effect.catch(showRepoRepositoryError)
);

// The repo row's … menu passes the Repo itself. Its sessions stay saved and their open tabs keep running; adding the
// repo again lists them again.
export const removeRepo = Effect.fn("removeRepo")(function* (repo: Repo) {
  const {modifyAddedRepoPaths} = yield* RepoRepository;
  yield* modifyAddedRepoPaths((storedAddedRepoPaths) =>
    storedAddedRepoPaths.filter((addedRepoPath) => addedRepoPath !== repo.path)
  );
}, Effect.catch(showRepoRepositoryError));

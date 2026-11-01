import {NoRepo, RepoPickCancelled} from "@/errors/repo.error.ts";
import {ErrorService} from "@/services/error.service.ts";
import {RepoStore} from "@/services/repo/repo.service.ts";
import {VsCodeService} from "@/services/vscode.service.ts";
import {ACTIONS, REPO_LABELS, REPO_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Match, Result, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {ReposCorrupt, ReposSaveFailed} from "@/errors/repo.error.ts";
import type {Repo} from "@/services/repo/repo.service.ts";

// Read-modify-write under the ref's permit. Re-reading first makes unreadable data fail the write, not get overwritten.
const modifyAddedRepoPaths = Effect.fn("modifyAddedRepoPaths")(function* (
  changeAddedRepoPaths: (storedAddedRepoPaths: readonly string[]) => readonly string[]
) {
  const {addedRepoPaths, loadAddedRepoPaths, saveAddedRepoPaths} = yield* RepoStore;

  const writeAddedRepoPathsChange = Effect.fn("writeAddedRepoPathsChange")(function* () {
    const nextAddedRepoPaths = changeAddedRepoPaths(yield* loadAddedRepoPaths);
    yield* saveAddedRepoPaths(nextAddedRepoPaths);

    return nextAddedRepoPaths;
  });

  yield* SubscriptionRef.updateEffect(addedRepoPaths, () => writeAddedRepoPathsChange());
});

const showRepoStoreError = Effect.fn("showRepoStoreError")(function* (repoStoreError: ReposCorrupt | ReposSaveFailed) {
  yield* Effect.forkDetach(
    ErrorService.use((errorService) =>
      errorService.showErrorMessage(
        Match.valueTags(repoStoreError, {
          ReposCorrupt: () => REPO_MESSAGES.UNREADABLE,
          ReposSaveFailed: () => REPO_MESSAGES.SAVE_FAILED
        })
      )
    )
  );
});

// This window's repos: its workspace folders, then the added paths that are not also one of them.
export const listRepos = Effect.fn("listRepos")(function* () {
  const {workspace} = yield* VsCodeService;
  const {addedRepoPaths} = yield* RepoStore;
  const path = yield* Path;
  const workspaceFolderRepos = (workspace.workspaceFolders ?? []).map((workspaceFolder): Repo => ({
    added: false,
    name: workspaceFolder.name,
    path: workspaceFolder.uri.fsPath
  }));
  const workspaceFolderPaths = new Set(workspaceFolderRepos.map((repo) => repo.path));
  const addedRepos = (yield* SubscriptionRef.get(addedRepoPaths))
    .filter((addedRepoPath) => !workspaceFolderPaths.has(addedRepoPath))
    .map((addedRepoPath): Repo => ({added: true, name: path.basename(addedRepoPath), path: addedRepoPath}));

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

  return yield* Effect.fromResult(Result.fromNullishOr(pickedItem?.repo, () => new RepoPickCancelled()));
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

  return (pickedFolderUris ?? []).map((folderUri) => folderUri.fsPath);
});

// ponytail: any folder counts as a repo, no git check. Worktree mode (M3) is where a non-git folder would first break.
export const addRepo = Effect.fn("addRepo")(function* () {
  const pickedFolderPaths = yield* pickFolderPaths();
  if (pickedFolderPaths.length === 0) return;

  yield* modifyAddedRepoPaths((storedAddedRepoPaths) => [
    ...new Set([...storedAddedRepoPaths, ...pickedFolderPaths])
  ]).pipe(Effect.catch(showRepoStoreError));
});

// The repo row's … menu passes the Repo itself. Its sessions stay saved and their open tabs keep running; adding the
// repo again lists them again.
export const removeRepo = Effect.fn("removeRepo")(function* (repo: Repo) {
  yield* modifyAddedRepoPaths((storedAddedRepoPaths) =>
    storedAddedRepoPaths.filter((addedRepoPath) => addedRepoPath !== repo.path)
  ).pipe(Effect.catch(showRepoStoreError));
});

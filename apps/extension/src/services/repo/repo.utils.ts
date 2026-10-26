import {NoRepo, RepoPickCancelled} from "@/errors/repo.error.ts";
import {ErrorService} from "@/services/error.service.ts";
import {RepoStore} from "@/services/repo/repo.service.ts";
import {VscService} from "@/services/vsc.service.ts";
import {ACTIONS, REPO_LABELS, REPO_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Match, Result, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {ReposCorrupt, ReposSaveFailed} from "@/errors/repo.error.ts";
import type {Repo} from "@/services/repo/repo.service.ts";

// Read-modify-write under the ref's permit. Re-reading first makes unreadable data fail the write, not get overwritten.
const modifyStored = Effect.fn("modifyStoredRepos")(function* (
  change: (stored: readonly string[]) => readonly string[]
) {
  const {added, load, save} = yield* RepoStore;

  const writeChange = Effect.fn("writeRepos")(function* () {
    const next = change(yield* load);
    yield* save(next);

    return next;
  });

  yield* SubscriptionRef.updateEffect(added, () => writeChange());
});

const showError = Effect.fn("showRepoError")(function* (error: ReposCorrupt | ReposSaveFailed) {
  yield* Effect.forkDetach(
    ErrorService.use((service) =>
      service.show(
        Match.valueTags(error, {
          ReposCorrupt: () => REPO_MESSAGES.UNREADABLE,
          ReposSaveFailed: () => REPO_MESSAGES.SAVE_FAILED
        })
      )
    )
  );
});

// This window's repos: its workspace folders, then the added paths that are not also one of them.
export const listRepos = Effect.fn("listRepos")(function* () {
  const {workspace} = yield* VscService;
  const {added} = yield* RepoStore;
  const path = yield* Path;
  const folders = (workspace.workspaceFolders ?? []).map((folder): Repo => ({
    added: false,
    name: folder.name,
    path: folder.uri.fsPath
  }));
  const taken = new Set(folders.map((repo) => repo.path));
  const extra = (yield* SubscriptionRef.get(added))
    .filter((repoPath) => !taken.has(repoPath))
    .map((repoPath): Repo => ({added: true, name: path.basename(repoPath), path: repoPath}));

  return [...folders, ...extra];
});

const showRepoPick = Effect.fn("showRepoPick")(function* (repos: readonly Repo[]) {
  const {window} = yield* VscService;
  const picked = yield* Effect.promise(async () =>
    window.showQuickPick(
      repos.map((repo) => ({description: repo.path, label: repo.name, repo})),
      {placeHolder: REPO_LABELS.PICK}
    )
  );

  return yield* Effect.fromResult(Result.fromNullishOr(picked?.repo, () => new RepoPickCancelled()));
});

// Asks only when the window has more than one repo.
export const pickRepo = Effect.fn("pickRepo")(function* () {
  const repos = yield* listRepos();
  if (repos.length > 1) return yield* showRepoPick(repos);

  return yield* Effect.fromResult(Result.fromNullishOr(repos[0], () => new NoRepo()));
});

const pickFolders = Effect.fn("pickFolders")(function* () {
  const {window} = yield* VscService;
  const picked = yield* Effect.promise(async () =>
    window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: true,
      openLabel: ACTIONS.ADD_REPO
    })
  );

  return (picked ?? []).map((uri) => uri.fsPath);
});

// ponytail: any folder counts as a repo, no git check. Worktree mode (M3) is where a non-git folder would first break.
export const addRepo = Effect.fn("addRepo")(function* () {
  const paths = yield* pickFolders();
  if (paths.length === 0) return;

  yield* modifyStored((stored) => [...new Set([...stored, ...paths])]).pipe(Effect.catch(showError));
});

// The repo row's … menu passes the Repo itself. Its sessions stay saved and their open tabs keep running; adding the
// repo again lists them again.
export const removeRepo = Effect.fn("removeRepo")(function* (repo: Repo) {
  yield* modifyStored((stored) => stored.filter((repoPath) => repoPath !== repo.path)).pipe(Effect.catch(showError));
});

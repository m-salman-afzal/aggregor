import {showErrorInBackground} from "@/application/utils/error.utils.ts";
import {RepoRepository} from "@/domain/entities/repo/repo.repository.ts";
import {ReposCorrupt, ReposSaveFailed} from "@/domain/errors/repo.error.ts";
import {
  NO_ADDED_REPO_PATHS,
  StoredAddedRepoPaths
} from "@/infrastructure/database/models/stored-added-repo-paths.model.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {STORAGE_KEYS} from "@pkg/constants/src/extension.constant.ts";
import {REPO_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Layer, Schema, SubscriptionRef} from "effect";

import type {RepoPath} from "@/domain/value-objects/repo-path.value-object.ts";
import type {Memento} from "vscode";

type AddedRepoPathsReference = SubscriptionRef.SubscriptionRef<readonly RepoPath[]>;

type ChangeAddedRepoPaths = (storedAddedRepoPaths: readonly RepoPath[]) => readonly RepoPath[];

// Re-reads workspaceState on every call.
const loadAddedRepoPaths = Effect.fn("RepoRepository.loadAddedRepoPaths")(
  function* (workspaceState: Memento) {
    const storedValue = yield* Effect.sync(() =>
      workspaceState.get<unknown>(STORAGE_KEYS.ADDED_REPO_PATHS, NO_ADDED_REPO_PATHS)
    );
    const storedAddedRepoPaths = yield* Schema.decodeUnknownEffect(StoredAddedRepoPaths)(storedValue);

    return storedAddedRepoPaths.addedRepoPaths;
  },
  Effect.mapError((cause) => new ReposCorrupt({cause}))
);

const saveAddedRepoPaths = Effect.fn("RepoRepository.saveAddedRepoPaths")(function* (
  workspaceState: Memento,
  addedRepoPaths: readonly RepoPath[]
) {
  const storedValue: typeof StoredAddedRepoPaths.Encoded = {addedRepoPaths, version: 1};

  yield* Effect.tryPromise({
    catch: (cause) => new ReposSaveFailed({cause}),
    try: async () => workspaceState.update(STORAGE_KEYS.ADDED_REPO_PATHS, storedValue)
  });
});

const writeAddedRepoPathsChange = Effect.fn("RepoRepository.writeAddedRepoPathsChange")(function* (
  workspaceState: Memento,
  changeAddedRepoPaths: ChangeAddedRepoPaths
) {
  const nextAddedRepoPaths = changeAddedRepoPaths(yield* loadAddedRepoPaths(workspaceState));
  yield* saveAddedRepoPaths(workspaceState, nextAddedRepoPaths);

  return nextAddedRepoPaths;
});

// Read-modify-write under the ref's permit. Re-reading first makes unreadable data fail the write, not get overwritten.
const modifyAddedRepoPaths = Effect.fn("RepoRepository.modifyAddedRepoPaths")(function* (
  workspaceState: Memento,
  addedRepoPaths: AddedRepoPathsReference,
  changeAddedRepoPaths: ChangeAddedRepoPaths
) {
  yield* SubscriptionRef.updateEffect(addedRepoPaths, () =>
    writeAddedRepoPathsChange(workspaceState, changeAddedRepoPaths)
  );
});

const showUnreadableReposError = Effect.fn("RepoRepository.showUnreadableReposError")(function* () {
  yield* showErrorInBackground(REPO_MESSAGES.UNREADABLE);
  const noRepoPaths: readonly RepoPath[] = [];

  return noRepoPaths;
});

// Unreadable data starts the list empty; every write re-reads first, so it is never overwritten.
const loadInitialAddedRepoPaths = Effect.fn("RepoRepository.loadInitialAddedRepoPaths")(
  function* (workspaceState: Memento) {
    return yield* loadAddedRepoPaths(workspaceState);
  },
  Effect.catchTag("ReposCorrupt", () => showUnreadableReposError())
);

const makeRepoRepositoryOnWorkspaceState = Effect.fn("RepoRepository.make")(function* () {
  const {workspaceState} = yield* VsCodeService;
  const addedRepoPaths: AddedRepoPathsReference = yield* SubscriptionRef.make(
    yield* loadInitialAddedRepoPaths(workspaceState)
  );

  return {
    addedRepoPaths,
    modifyAddedRepoPaths: (changeAddedRepoPaths: ChangeAddedRepoPaths) =>
      modifyAddedRepoPaths(workspaceState, addedRepoPaths, changeAddedRepoPaths)
  };
});

// workspaceState belongs to this workspace, so other windows never see these paths.
export const RepoRepositoryOnWorkspaceState = Layer.effect(RepoRepository, makeRepoRepositoryOnWorkspaceState());

import {RepoPathSchema} from "@/domain/value-objects/repo-path.value-object.ts";
import {ReposCorrupt, ReposSaveFailed} from "@/errors/repo.error.ts";
import {showErrorInBackground} from "@/services/error.utils.ts";
import {VsCodeService} from "@/services/vscode.service.ts";
import {STORAGE_KEYS} from "@pkg/constants/src/extension.constant.ts";
import {REPO_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Context, Effect, Layer, Schema, SubscriptionRef} from "effect";

import type {RepoPath} from "@/domain/value-objects/repo-path.value-object.ts";
import type {Memento} from "vscode";

// Any change to this shape bumps `version`, so older code fails to decode it instead of writing back a stripped copy.
const StoredAddedRepoPaths = Schema.Struct({
  addedRepoPaths: Schema.Array(RepoPathSchema),
  version: Schema.Literal(1)
});

const NO_ADDED_REPO_PATHS: typeof StoredAddedRepoPaths.Encoded = {addedRepoPaths: [], version: 1};

// Re-reads workspaceState on every call.
const loadAddedRepoPaths = Effect.fn("RepoStore.loadAddedRepoPaths")(
  function* (workspaceState: Memento) {
    const storedValue = yield* Effect.sync(() =>
      workspaceState.get<unknown>(STORAGE_KEYS.ADDED_REPO_PATHS, NO_ADDED_REPO_PATHS)
    );
    const storedAddedRepoPaths = yield* Schema.decodeUnknownEffect(StoredAddedRepoPaths)(storedValue);

    return storedAddedRepoPaths.addedRepoPaths;
  },
  Effect.mapError((cause) => new ReposCorrupt({cause}))
);

const saveAddedRepoPaths = Effect.fn("RepoStore.saveAddedRepoPaths")(function* (
  workspaceState: Memento,
  addedRepoPaths: readonly RepoPath[]
) {
  const storedValue: typeof StoredAddedRepoPaths.Encoded = {addedRepoPaths, version: 1};

  yield* Effect.tryPromise({
    catch: (cause) => new ReposSaveFailed({cause}),
    try: async () => workspaceState.update(STORAGE_KEYS.ADDED_REPO_PATHS, storedValue)
  });
});

const showUnreadableReposError = Effect.fn("RepoStore.showUnreadableReposError")(function* () {
  yield* showErrorInBackground(REPO_MESSAGES.UNREADABLE);
  const noRepoPaths: readonly RepoPath[] = [];

  return noRepoPaths;
});

// Unreadable data starts the list empty; every write re-reads first, so it is never overwritten.
const loadInitialAddedRepoPaths = Effect.fn("RepoStore.loadInitialAddedRepoPaths")(
  function* (workspaceState: Memento) {
    return yield* loadAddedRepoPaths(workspaceState);
  },
  Effect.catchTag("ReposCorrupt", () => showUnreadableReposError())
);

const makeRepoStore = Effect.fn("RepoStore.make")(function* () {
  const {workspaceState} = yield* VsCodeService;
  const addedRepoPaths = yield* SubscriptionRef.make(yield* loadInitialAddedRepoPaths(workspaceState));

  return {
    addedRepoPaths,
    loadAddedRepoPaths: () => loadAddedRepoPaths(workspaceState),
    saveAddedRepoPaths: (nextAddedRepoPaths: readonly RepoPath[]) =>
      saveAddedRepoPaths(workspaceState, nextAddedRepoPaths)
  };
});

// The paths added with Add Repo. workspaceState belongs to this workspace, so other windows never see them; workspace
// folders are not stored, VS Code already lists them.
export class RepoStore extends Context.Service<
  RepoStore,
  {
    readonly addedRepoPaths: SubscriptionRef.SubscriptionRef<readonly RepoPath[]>;
    readonly loadAddedRepoPaths: () => Effect.Effect<readonly RepoPath[], ReposCorrupt>;
    readonly saveAddedRepoPaths: (addedRepoPaths: readonly RepoPath[]) => Effect.Effect<void, ReposSaveFailed>;
  }
>()("aggregor/services/repo/repo.service/RepoStore") {
  public static readonly layer = Layer.effect(RepoStore, makeRepoStore());
}

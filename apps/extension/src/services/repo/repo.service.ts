import {ReposCorrupt, ReposSaveFailed} from "@/errors/repo.error.ts";
import {ErrorService} from "@/services/error.service.ts";
import {VsCodeService} from "@/services/vscode.service.ts";
import {STORAGE_KEYS} from "@pkg/constants/src/extension.constant.ts";
import {REPO_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Context, Effect, Layer, Schema, SubscriptionRef} from "effect";

// A top-level row of the Sessions tree. A workspace folder is always listed and `added` is false; one added with Add
// Repo is `added` and can be removed again.
export interface Repo {
  readonly added: boolean;
  readonly name: string;
  readonly path: string;
}

// Any change to this shape bumps `version`, so older code fails to decode it instead of writing back a stripped copy.
const StoredAddedRepoPaths = Schema.Struct({
  addedRepoPaths: Schema.Array(Schema.String),
  version: Schema.Literal(1)
});

const NO_ADDED_REPO_PATHS: typeof StoredAddedRepoPaths.Encoded = {addedRepoPaths: [], version: 1};

// The paths added with Add Repo. workspaceState belongs to this workspace, so other windows never see them; workspace
// folders are not stored, VS Code already lists them.
export class RepoStore extends Context.Service<
  RepoStore,
  {
    readonly addedRepoPaths: SubscriptionRef.SubscriptionRef<readonly string[]>;
    readonly loadAddedRepoPaths: Effect.Effect<readonly string[], ReposCorrupt>;
    readonly saveAddedRepoPaths: (addedRepoPaths: readonly string[]) => Effect.Effect<void, ReposSaveFailed>;
  }
>()("aggregor/services/repo/repo.service/RepoStore") {
  public static readonly layer = Layer.effect(
    RepoStore,
    Effect.gen(function* () {
      const {workspaceState} = yield* VsCodeService;

      // Re-reads workspaceState on every run.
      const loadAddedRepoPaths = Effect.gen(function* () {
        const storedValue = yield* Effect.sync(() =>
          workspaceState.get<unknown>(STORAGE_KEYS.ADDED_REPO_PATHS, NO_ADDED_REPO_PATHS)
        );
        const storedAddedRepoPaths = yield* Schema.decodeUnknownEffect(StoredAddedRepoPaths)(storedValue).pipe(
          Effect.catchTag("SchemaError", (cause) => Effect.fail(new ReposCorrupt({cause})))
        );

        return storedAddedRepoPaths.addedRepoPaths;
      }).pipe(Effect.withSpan("RepoStore.loadAddedRepoPaths"));

      const saveAddedRepoPaths = Effect.fn("RepoStore.saveAddedRepoPaths")(function* (
        addedRepoPaths: readonly string[]
      ) {
        const storedValue: typeof StoredAddedRepoPaths.Encoded = {addedRepoPaths, version: 1};

        yield* Effect.tryPromise({
          catch: (cause) => new ReposSaveFailed({cause}),
          try: async () => workspaceState.update(STORAGE_KEYS.ADDED_REPO_PATHS, storedValue)
        });
      });

      const showUnreadableReposError = Effect.fn("RepoStore.showUnreadableReposError")(function* () {
        yield* Effect.forkDetach(
          ErrorService.use((errorService) => errorService.showErrorMessage(REPO_MESSAGES.UNREADABLE))
        );
        const noRepoPaths: readonly string[] = [];

        return noRepoPaths;
      });

      // Unreadable data starts the list empty; every write re-reads first, so it is never overwritten.
      const initialAddedRepoPaths = yield* loadAddedRepoPaths.pipe(
        Effect.catchTag("ReposCorrupt", () => showUnreadableReposError())
      );
      const addedRepoPaths = yield* SubscriptionRef.make<readonly string[]>(initialAddedRepoPaths);

      return RepoStore.of({addedRepoPaths, loadAddedRepoPaths, saveAddedRepoPaths});
    })
  );
}

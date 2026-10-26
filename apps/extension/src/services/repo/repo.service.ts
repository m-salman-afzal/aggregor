import {ReposCorrupt, ReposSaveFailed} from "@/errors/repo.error.ts";
import {ErrorService} from "@/services/error.service.ts";
import {VscService} from "@/services/vsc.service.ts";
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
const StoredRepos = Schema.Struct({
  repos: Schema.Array(Schema.String),
  version: Schema.Literal(1)
});

const EMPTY: typeof StoredRepos.Encoded = {repos: [], version: 1};

// The paths added with Add Repo. workspaceState belongs to this workspace, so other windows never see them; workspace
// folders are not stored, VS Code already lists them.
export class RepoStore extends Context.Service<
  RepoStore,
  {
    readonly added: SubscriptionRef.SubscriptionRef<readonly string[]>;
    readonly load: Effect.Effect<readonly string[], ReposCorrupt>;
    readonly save: (paths: readonly string[]) => Effect.Effect<void, ReposSaveFailed>;
  }
>()("aggregor/services/repo/repo.service/RepoStore") {
  public static readonly layer = Layer.effect(
    RepoStore,
    Effect.gen(function* () {
      const {workspaceState} = yield* VscService;

      // Re-reads workspaceState on every run.
      const load = Effect.gen(function* () {
        const stored = yield* Effect.sync(() => workspaceState.get<unknown>(STORAGE_KEYS.REPOS, EMPTY));
        const decoded = yield* Schema.decodeUnknownEffect(StoredRepos)(stored).pipe(
          Effect.catchTag("SchemaError", (cause) => Effect.fail(new ReposCorrupt({cause})))
        );

        return decoded.repos;
      }).pipe(Effect.withSpan("loadRepos"));

      const save = Effect.fn("saveRepos")(function* (paths: readonly string[]) {
        const stored: typeof StoredRepos.Encoded = {repos: paths, version: 1};

        yield* Effect.tryPromise({
          catch: (cause) => new ReposSaveFailed({cause}),
          try: async () => workspaceState.update(STORAGE_KEYS.REPOS, stored)
        });
      });

      const showUnreadable = Effect.fn("showUnreadable")(function* () {
        yield* Effect.forkDetach(ErrorService.use((service) => service.show(REPO_MESSAGES.UNREADABLE)));
        const empty: readonly string[] = [];

        return empty;
      });

      // Unreadable data starts the list empty; every write re-reads first, so it is never overwritten.
      const initial = yield* load.pipe(Effect.catchTag("ReposCorrupt", () => showUnreadable()));
      const added = yield* SubscriptionRef.make<readonly string[]>(initial);

      return RepoStore.of({added, load, save});
    })
  );
}

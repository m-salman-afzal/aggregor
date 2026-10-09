import {VscService} from "@/services/vsc.service.ts";
import {HOOKS_FILE} from "@pkg/constants/src/extension.constant.ts";
import {Context, Effect, Layer, Option, Schema, Stream, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

const StatusSchema = Schema.Literals(["running", "needs-input", "idle", "exited"]);

export type Status = typeof StatusSchema.Type;

const decodeStatus = Schema.decodeUnknownOption(StatusSchema);

// What each session's agent is doing. The hooks in HOOKS_FILE write one word per session to a file in global storage,
// which every window shares, and this service watches that folder.
export class StatusService extends Context.Service<
  StatusService,
  {
    readonly clear: (id: string) => Effect.Effect<void>;
    readonly fileOf: (id: string) => string;
    readonly hooksFile: string;
    readonly statuses: SubscriptionRef.SubscriptionRef<ReadonlyMap<string, Status>>;
  }
>()("aggregor/services/session/status.service/StatusService") {
  public static readonly layer = Layer.effect(
    StatusService,
    Effect.gen(function* () {
      const fs = yield* FileSystem;
      const path = yield* Path;
      const {extensionUri, globalStorageUri, Uri} = yield* VscService;
      const dir = path.join(globalStorageUri.fsPath, "status");
      const hooksFile = Uri.joinPath(extensionUri, HOOKS_FILE).fsPath;
      const statuses = yield* SubscriptionRef.make<ReadonlyMap<string, Status>>(new Map());

      const fileOf = (id: string) => path.join(dir, id);

      // Only publishes real changes, since every tool call rewrites "running".
      const publishStatus = Effect.fn("publishStatus")(function* (id: string, status: Option.Option<Status>) {
        const current = yield* SubscriptionRef.get(statuses);
        if (Option.getOrUndefined(status) === current.get(id)) return;

        const next = new Map(current);
        if (Option.isSome(status)) next.set(id, status.value);
        else next.delete(id);
        yield* SubscriptionRef.set(statuses, next);
      });

      // A missing or half-written file drops the entry; the hook's next write puts it back.
      const refreshStatus = Effect.fn("refreshStatus")(function* (id: string) {
        const text = yield* Effect.option(fs.readFileString(fileOf(id)));

        yield* publishStatus(id, Option.flatMap(text, decodeStatus));
      });

      const watchStatuses = Effect.fn("watchStatuses")(function* () {
        yield* fs.makeDirectory(dir, {recursive: true});
        yield* Stream.runForEach(fs.watch(dir), (event) => refreshStatus(path.basename(event.path)));
      });

      // Without the folder, rows show no status; the sessions themselves keep working.
      yield* Effect.forkScoped(Effect.ignore(watchStatuses(), {log: true}));

      // Runs before each launch, so a word left by the last run never shows, and when a session is removed.
      const clear = Effect.fn("clear")(function* (id: string) {
        yield* Effect.ignore(fs.remove(fileOf(id), {force: true}));
      });

      return StatusService.of({clear, fileOf, hooksFile, statuses});
    })
  );
}

import {VsCodeService} from "@/services/vscode.service.ts";
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
    readonly clearStatusFile: (sessionId: string) => Effect.Effect<void>;
    readonly getStatusFilePath: (sessionId: string) => string;
    readonly hooksFilePath: string;
    readonly sessionStatuses: SubscriptionRef.SubscriptionRef<ReadonlyMap<string, Status>>;
  }
>()("aggregor/services/session/status.service/StatusService") {
  public static readonly layer = Layer.effect(
    StatusService,
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem;
      const path = yield* Path;
      const {extensionUri, globalStorageUri, Uri} = yield* VsCodeService;
      const statusDirectoryPath = path.join(globalStorageUri.fsPath, "status");
      const hooksFilePath = Uri.joinPath(extensionUri, HOOKS_FILE).fsPath;
      const sessionStatuses = yield* SubscriptionRef.make<ReadonlyMap<string, Status>>(new Map());

      const getStatusFilePath = (sessionId: string) => path.join(statusDirectoryPath, sessionId);

      // Only publishes real changes, since every tool call rewrites "running".
      const publishSessionStatus = Effect.fn("StatusService.publishSessionStatus")(function* (
        sessionId: string,
        sessionStatus: Option.Option<Status>
      ) {
        const currentStatuses = yield* SubscriptionRef.get(sessionStatuses);
        if (Option.getOrUndefined(sessionStatus) === currentStatuses.get(sessionId)) return;

        const nextStatuses = new Map(currentStatuses);
        if (Option.isSome(sessionStatus)) nextStatuses.set(sessionId, sessionStatus.value);
        else nextStatuses.delete(sessionId);
        yield* SubscriptionRef.set(sessionStatuses, nextStatuses);
      });

      // A missing or half-written file drops the entry; the hook's next write puts it back.
      const refreshSessionStatus = Effect.fn("StatusService.refreshSessionStatus")(function* (sessionId: string) {
        const statusFileText = yield* Effect.option(fileSystem.readFileString(getStatusFilePath(sessionId)));

        yield* publishSessionStatus(sessionId, Option.flatMap(statusFileText, decodeStatus));
      });

      const watchStatusDirectory = Effect.fn("StatusService.watchStatusDirectory")(function* () {
        yield* fileSystem.makeDirectory(statusDirectoryPath, {recursive: true});
        yield* Stream.runForEach(fileSystem.watch(statusDirectoryPath), (fileSystemEvent) =>
          refreshSessionStatus(path.basename(fileSystemEvent.path))
        );
      });

      // Without the folder, rows show no status; the sessions themselves keep working.
      yield* Effect.forkScoped(
        watchStatusDirectory().pipe(Effect.ignore({log: "Warn", message: "Could not watch session statuses"}))
      );

      // Runs before each launch, so a word left by the last run never shows, and when a session is removed.
      const clearStatusFile = Effect.fn("StatusService.clearStatusFile")(function* (sessionId: string) {
        yield* fileSystem
          .remove(getStatusFilePath(sessionId), {force: true})
          .pipe(Effect.ignore({log: "Warn", message: `Could not clear the status file of session ${sessionId}`}));
      });

      return StatusService.of({clearStatusFile, getStatusFilePath, hooksFilePath, sessionStatuses});
    })
  );
}

import {VsCodeService} from "@/services/vscode.service.ts";
import {HOOKS_FILE} from "@pkg/constants/src/extension.constant.ts";
import {Context, Effect, Layer, Result, Schema, Stream, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

const StatusSchema = Schema.Literals(["running", "needs-input", "idle", "exited"]);

export type Status = typeof StatusSchema.Type;

const decodeStatus = Schema.decodeUnknownResult(StatusSchema);

const makeStatusService = Effect.fn("StatusService.make")(function* () {
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
    sessionStatus: Result.Result<Status, unknown>
  ) {
    const currentStatuses = yield* SubscriptionRef.get(sessionStatuses);
    const nextStatus = Result.getOrUndefined(sessionStatus);
    if (nextStatus === currentStatuses.get(sessionId)) return;

    const nextStatuses = new Map(currentStatuses);
    if (nextStatus === undefined) nextStatuses.delete(sessionId);
    else nextStatuses.set(sessionId, nextStatus);
    yield* SubscriptionRef.set(sessionStatuses, nextStatuses);
  });

  // A missing or half-written file drops the entry; the hook's next write puts it back.
  const refreshSessionStatus = Effect.fn("StatusService.refreshSessionStatus")(function* (sessionId: string) {
    const statusFileText = yield* Effect.result(fileSystem.readFileString(getStatusFilePath(sessionId)));

    yield* publishSessionStatus(sessionId, Result.flatMap(statusFileText, decodeStatus));
  });

  // Without the folder, rows show no status; the sessions themselves keep working.
  const watchStatusDirectory = Effect.fn("StatusService.watchStatusDirectory")(
    function* () {
      yield* fileSystem.makeDirectory(statusDirectoryPath, {recursive: true});
      yield* Stream.runForEach(fileSystem.watch(statusDirectoryPath), (fileSystemEvent) =>
        refreshSessionStatus(path.basename(fileSystemEvent.path))
      );
    },
    Effect.ignore({log: "Warn", message: "Could not watch session statuses"})
  );
  yield* Effect.forkScoped(watchStatusDirectory());

  // Runs before each launch, so a word left by the last run never shows, and when a session is removed.
  const clearStatusFile = Effect.fn("StatusService.clearStatusFile")(
    function* (sessionId: string) {
      yield* fileSystem.remove(getStatusFilePath(sessionId), {force: true});
    },
    (effect, sessionId) =>
      Effect.ignore(effect, {log: "Warn", message: `Could not clear the status file of session ${sessionId}`})
  );

  return {clearStatusFile, getStatusFilePath, hooksFilePath, sessionStatuses};
});

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
  public static readonly layer = Layer.effect(StatusService, makeStatusService());
}

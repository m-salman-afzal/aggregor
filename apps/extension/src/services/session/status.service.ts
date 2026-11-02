import {VsCodeService} from "@/services/vscode.service.ts";
import {HOOKS_FILE} from "@pkg/constants/src/extension.constant.ts";
import {Context, Effect, Layer, Result, Schema, Stream, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

const StatusSchema = Schema.Literals(["running", "needs-input", "idle", "exited"]);

export type Status = typeof StatusSchema.Type;

const decodeStatus = Schema.decodeUnknownResult(StatusSchema);

// Each session's status, keyed by session id.
type SessionStatusesReference = SubscriptionRef.SubscriptionRef<ReadonlyMap<string, Status>>;

// Only publishes real changes, since every tool call rewrites "running".
const publishSessionStatus = Effect.fn("StatusService.publishSessionStatus")(function* (
  sessionStatuses: SessionStatusesReference,
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
const refreshSessionStatus = Effect.fn("StatusService.refreshSessionStatus")(function* (
  sessionStatuses: SessionStatusesReference,
  statusDirectoryPath: string,
  sessionId: string
) {
  const fileSystem = yield* FileSystem;
  const path = yield* Path;
  const statusFileText = yield* Effect.result(fileSystem.readFileString(path.join(statusDirectoryPath, sessionId)));

  yield* publishSessionStatus(sessionStatuses, sessionId, Result.flatMap(statusFileText, decodeStatus));
});

// Without the folder, rows show no status; the sessions themselves keep working. Watch events name the changed file.
const watchStatusDirectory = Effect.fn("StatusService.watchStatusDirectory")(
  function* (sessionStatuses: SessionStatusesReference, statusDirectoryPath: string) {
    const fileSystem = yield* FileSystem;
    const path = yield* Path;
    yield* fileSystem.makeDirectory(statusDirectoryPath, {recursive: true});
    yield* Stream.runForEach(fileSystem.watch(statusDirectoryPath), (fileSystemEvent) =>
      refreshSessionStatus(sessionStatuses, statusDirectoryPath, path.basename(fileSystemEvent.path))
    );
  },
  Effect.ignore({log: "Warn", message: "Could not watch session statuses"})
);

// Runs before each launch, so a word left by the last run never shows, and when a session is removed.
const clearStatusFile = Effect.fn("StatusService.clearStatusFile")(
  function* (fileSystem: FileSystem, statusFilePath: string) {
    yield* fileSystem.remove(statusFilePath, {force: true});
  },
  (effect, _fileSystem, statusFilePath) =>
    Effect.ignore(effect, {log: "Warn", message: `Could not clear the status file ${statusFilePath}`})
);

const makeStatusService = Effect.fn("StatusService.make")(function* () {
  const fileSystem = yield* FileSystem;
  const path = yield* Path;
  const {extensionUri, globalStorageUri, Uri} = yield* VsCodeService;
  const statusDirectoryPath = path.join(globalStorageUri.fsPath, "status");
  const sessionStatuses: SessionStatusesReference = yield* SubscriptionRef.make<ReadonlyMap<string, Status>>(new Map());
  const getStatusFilePath = (sessionId: string) => path.join(statusDirectoryPath, sessionId);
  yield* Effect.forkScoped(watchStatusDirectory(sessionStatuses, statusDirectoryPath));

  return {
    clearStatusFile: (sessionId: string) => clearStatusFile(fileSystem, getStatusFilePath(sessionId)),
    getStatusFilePath,
    hooksFilePath: Uri.joinPath(extensionUri, HOOKS_FILE).fsPath,
    sessionStatuses
  };
});

// What each session's agent is doing. The hooks in HOOKS_FILE write one word per session to a file in global storage,
// which every window shares, and this service watches that folder.
export class StatusService extends Context.Service<
  StatusService,
  {
    readonly clearStatusFile: (sessionId: string) => Effect.Effect<void>;
    readonly getStatusFilePath: (sessionId: string) => string;
    readonly hooksFilePath: string;
    readonly sessionStatuses: SessionStatusesReference;
  }
>()("aggregor/services/session/status.service/StatusService") {
  public static readonly layer = Layer.effect(StatusService, makeStatusService());
}

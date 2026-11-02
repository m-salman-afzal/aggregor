import {decodeStatusFileText} from "@/domain/transformers/claude-code.transformer.ts";
import {decodeSessionId} from "@/domain/value-objects/session-id.value-object.ts";
import {VsCodeService} from "@/services/vscode.service.ts";
import {HOOKS_FILE} from "@pkg/constants/src/extension.constant.ts";
import {Context, Effect, Layer, Result, Stream, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

import type {SessionId} from "@/domain/value-objects/session-id.value-object.ts";
import type {Status} from "@/domain/value-objects/status.value-object.ts";

// Each session's status, keyed by session id.
type SessionStatusesReference = SubscriptionRef.SubscriptionRef<ReadonlyMap<SessionId, Status>>;

// Only publishes real changes, since every tool call rewrites "running".
const publishSessionStatus = Effect.fn("StatusService.publishSessionStatus")(function* (
  sessionStatuses: SessionStatusesReference,
  sessionId: SessionId,
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
  sessionId: SessionId
) {
  const fileSystem = yield* FileSystem;
  const path = yield* Path;
  const statusFileText = yield* Effect.result(fileSystem.readFileString(path.join(statusDirectoryPath, sessionId)));

  yield* publishSessionStatus(sessionStatuses, sessionId, Result.flatMap(statusFileText, decodeStatusFileText));
});

// Without the folder, rows show no status; the sessions themselves keep working. Watch events name the changed file,
// and a file not named after a session id is not ours.
const watchStatusDirectory = Effect.fn("StatusService.watchStatusDirectory")(
  function* (sessionStatuses: SessionStatusesReference, statusDirectoryPath: string) {
    const fileSystem = yield* FileSystem;
    const path = yield* Path;
    yield* fileSystem.makeDirectory(statusDirectoryPath, {recursive: true});
    const changedSessionIds = Stream.filterMap(fileSystem.watch(statusDirectoryPath), (fileSystemEvent) =>
      decodeSessionId(path.basename(fileSystemEvent.path))
    );
    yield* Stream.runForEach(changedSessionIds, (sessionId) =>
      refreshSessionStatus(sessionStatuses, statusDirectoryPath, sessionId)
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
  const sessionStatuses: SessionStatusesReference = yield* SubscriptionRef.make<ReadonlyMap<SessionId, Status>>(
    new Map()
  );
  const getStatusFilePath = (sessionId: SessionId) => path.join(statusDirectoryPath, sessionId);
  yield* Effect.forkScoped(watchStatusDirectory(sessionStatuses, statusDirectoryPath));

  return {
    clearStatusFile: (sessionId: SessionId) => clearStatusFile(fileSystem, getStatusFilePath(sessionId)),
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
    readonly clearStatusFile: (sessionId: SessionId) => Effect.Effect<void>;
    readonly getStatusFilePath: (sessionId: SessionId) => string;
    readonly hooksFilePath: string;
    readonly sessionStatuses: SessionStatusesReference;
  }
>()("aggregor/services/session/status.service/StatusService") {
  public static readonly layer = Layer.effect(StatusService, makeStatusService());
}

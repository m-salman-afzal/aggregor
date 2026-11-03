import {decodeStatusFileText} from "@/domain/transformers/claude-code.transformer.ts";
import {decodeSessionId} from "@/domain/value-objects/session-id.value-object.ts";
import {Effect, Result, Stream, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

import type {SessionId} from "@/domain/value-objects/session-id.value-object.ts";
import type {Status} from "@/domain/value-objects/status.value-object.ts";

// Each session's status, keyed by session id.
export type SessionStatusesReference = SubscriptionRef.SubscriptionRef<ReadonlyMap<SessionId, Status>>;

// Only publishes real changes, since every tool call rewrites "running".
const publishSessionStatus = Effect.fn("ClaudeCodeHarnessClient.publishSessionStatus")(function* (
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
const refreshSessionStatus = Effect.fn("ClaudeCodeHarnessClient.refreshSessionStatus")(function* (
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
export const watchStatusDirectory = Effect.fn("ClaudeCodeHarnessClient.watchStatusDirectory")(
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
export const clearStatusFile = Effect.fn("ClaudeCodeHarnessClient.clearStatusFile")(
  function* (fileSystem: FileSystem, statusFilePath: string) {
    yield* fileSystem.remove(statusFilePath, {force: true});
  },
  (effect, _fileSystem, statusFilePath) =>
    Effect.ignore(effect, {log: "Warn", message: `Could not clear the status file ${statusFilePath}`})
);

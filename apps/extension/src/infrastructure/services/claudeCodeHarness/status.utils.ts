import {decodeStatusFileText} from "@infraServices/claudeCodeHarness/claudeCode.transformer.ts";
import {decodeEntityId} from "@valueObjects/entityId.valueObject.ts";
import {Effect, Result, Stream, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

import type {SessionStatusesReference} from "@infraServices/claudeCodeHarness/claudeCodeHarness.infraService.type.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {StatusValueObject} from "@valueObjects/status.valueObject.ts";

// Only publishes real changes, since every tool call rewrites "running".
const publishSessionStatus = Effect.fn("ClaudeCodeHarnessInfraService.publishSessionStatus")(function* (
  sessionStatuses: SessionStatusesReference,
  sessionId: EntityIdValueObject,
  sessionStatus: Result.Result<StatusValueObject, unknown>
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
const refreshSessionStatus = Effect.fn("ClaudeCodeHarnessInfraService.refreshSessionStatus")(function* (
  sessionStatuses: SessionStatusesReference,
  statusDirectoryPath: string,
  sessionId: EntityIdValueObject
) {
  const fileSystem = yield* FileSystem;
  const path = yield* Path;
  const statusFileText = yield* Effect.result(fileSystem.readFileString(path.join(statusDirectoryPath, sessionId)));

  yield* publishSessionStatus(sessionStatuses, sessionId, Result.flatMap(statusFileText, decodeStatusFileText));
});

// Without the folder, rows show no status; the sessions themselves keep working. Watch events name the changed file,
// and a file not named after a session id is not ours.
export const watchStatusDirectory = Effect.fn("ClaudeCodeHarnessInfraService.watchStatusDirectory")(
  function* (sessionStatuses: SessionStatusesReference, statusDirectoryPath: string) {
    const fileSystem = yield* FileSystem;
    const path = yield* Path;
    yield* fileSystem.makeDirectory(statusDirectoryPath, {recursive: true});
    const changedSessionIds = Stream.filterMap(fileSystem.watch(statusDirectoryPath), (fileSystemEvent) =>
      decodeEntityId(path.basename(fileSystemEvent.path))
    );
    yield* Stream.runForEach(changedSessionIds, (sessionId) =>
      refreshSessionStatus(sessionStatuses, statusDirectoryPath, sessionId)
    );
  },
  Effect.ignore({log: "Warn", message: "Could not watch session statuses"})
);

// Claude runs no Stop hook for an interrupted turn, so this writes the word that hook would have.
export const writeIdleStatusFile = Effect.fn("ClaudeCodeHarnessInfraService.writeIdleStatusFile")(
  function* (fileSystem: FileSystem, statusFilePath: string) {
    yield* fileSystem.writeFileString(statusFilePath, "idle" satisfies StatusValueObject);
  },
  (effect, _fileSystem, statusFilePath) =>
    Effect.ignore(effect, {log: "Warn", message: `Could not write idle to the status file ${statusFilePath}`})
);

// Runs before each launch, so a word left by the last run never shows, and when a session is removed.
export const clearStatusFile = Effect.fn("ClaudeCodeHarnessInfraService.clearStatusFile")(
  function* (fileSystem: FileSystem, statusFilePath: string) {
    yield* fileSystem.remove(statusFilePath, {force: true});
  },
  (effect, _fileSystem, statusFilePath) =>
    Effect.ignore(effect, {log: "Warn", message: `Could not clear the status file ${statusFilePath}`})
);

import {SessionTitleNotFound} from "@/application/errors/harness.error.ts";
import {getPreferredTitle, NO_TITLES} from "@/domain/transformers/claude-code.transformer.ts";
import {decodeSessionId} from "@/domain/value-objects/session-id.value-object.ts";
import {
  findTranscriptFilePath,
  getClaudeProjectsDirectoryPath,
  readNewTitles
} from "@/infrastructure/clients/claude-code/transcript.utils.ts";
import {Effect, Result, Schedule, Stream, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

import type {Session} from "@/domain/entities/session/session.entity.ts";
import type {TitleNotFound} from "@/domain/errors/session.error.ts";
import type {SessionId} from "@/domain/value-objects/session-id.value-object.ts";
import type {TranscriptProgress} from "@/infrastructure/clients/claude-code/transcript.utils.ts";

// Each session's title, keyed by session id.
export type SessionTitlesReference = SubscriptionRef.SubscriptionRef<ReadonlyMap<SessionId, string>>;

// What the title watcher reads and updates.
export interface TitleTracking {
  readonly sessionTitles: SessionTitlesReference;
  readonly trackedSessions: SubscriptionRef.SubscriptionRef<readonly Session[]>;
  readonly transcriptProgressBySessionId: Map<SessionId, TranscriptProgress>;
}

const getTranscriptProgress = Effect.fn("ClaudeCodeHarnessClient.getTranscriptProgress")(function* (
  titleTracking: TitleTracking,
  sessionId: SessionId
) {
  const knownProgress = titleTracking.transcriptProgressBySessionId.get(sessionId);
  if (knownProgress !== undefined) return knownProgress;

  const transcriptFilePath = yield* findTranscriptFilePath(sessionId);
  const freshProgress: TranscriptProgress = {byteOffset: 0n, titles: NO_TITLES, transcriptFilePath};

  return freshProgress;
});

// Only publishes real changes, since Claude writes to its transcript many times per turn.
const publishSessionTitle = Effect.fn("ClaudeCodeHarnessClient.publishSessionTitle")(function* (
  sessionTitles: SessionTitlesReference,
  sessionId: SessionId,
  sessionTitle: Result.Result<string, TitleNotFound>
) {
  const currentTitles = yield* SubscriptionRef.get(sessionTitles);
  if (Result.isFailure(sessionTitle) || currentTitles.get(sessionId) === sessionTitle.success) return;

  yield* SubscriptionRef.set(sessionTitles, new Map(currentTitles).set(sessionId, sessionTitle.success));
});

const refreshSessionTitle = Effect.fn("ClaudeCodeHarnessClient.refreshSessionTitle")(function* (
  titleTracking: TitleTracking,
  sessionId: SessionId
) {
  const fileSystem = yield* FileSystem;
  const knownProgress = yield* getTranscriptProgress(titleTracking, sessionId);
  const {size: transcriptSize} = yield* fileSystem.stat(knownProgress.transcriptFilePath);
  // A transcript that shrank was rewritten, so read it again from the start.
  const startingProgress =
    transcriptSize < knownProgress.byteOffset ? {...knownProgress, byteOffset: 0n, titles: NO_TITLES} : knownProgress;
  const nextProgress = yield* readNewTitles(startingProgress, transcriptSize);

  yield* Effect.sync(() => titleTracking.transcriptProgressBySessionId.set(sessionId, nextProgress));
  yield* publishSessionTitle(titleTracking.sessionTitles, sessionId, getPreferredTitle(nextProgress.titles));
});

// The watcher sees every Claude session on this machine; only ours are read. A session has no transcript until its
// first message.
const refreshTrackedSessionTitle = Effect.fn("ClaudeCodeHarnessClient.refreshTrackedSessionTitle")(
  function* (titleTracking: TitleTracking, sessionId: SessionId) {
    const trackedSessions = yield* SubscriptionRef.get(titleTracking.trackedSessions);
    if (!trackedSessions.some((session) => session.id === sessionId)) return;

    yield* refreshSessionTitle(titleTracking, sessionId);
  },
  Effect.catchTag("TranscriptNotFound", () => Effect.void),
  (effect, _titleTracking, sessionId) =>
    Effect.ignore(effect, {log: "Warn", message: `Could not read the title of session ${sessionId}`})
);

const refreshSessionTitles = Effect.fn("ClaudeCodeHarnessClient.refreshSessionTitles")(function* (
  titleTracking: TitleTracking,
  sessionIds: readonly SessionId[]
) {
  for (const sessionId of new Set(sessionIds)) yield* refreshTrackedSessionTitle(titleTracking, sessionId);
});

const watchClaudeProjects = Effect.fn("ClaudeCodeHarnessClient.watchClaudeProjects")(function* () {
  const fileSystem = yield* FileSystem;
  const projectsDirectoryPath = yield* getClaudeProjectsDirectoryPath();

  return fileSystem.watch(projectsDirectoryPath, {recursive: true});
});

// Every tracked session once per list change (which also covers startup), plus each transcript Claude writes.
const watchSessionIdBatches = Effect.fn("ClaudeCodeHarnessClient.watchSessionIdBatches")(function* (
  trackedSessions: SubscriptionRef.SubscriptionRef<readonly Session[]>
) {
  const path = yield* Path;
  const trackedSessionIds = Stream.flatMap(SubscriptionRef.changes(trackedSessions), (sessions) =>
    Stream.fromIterable(sessions.map((session) => session.id))
  );
  // Files not named after a session id, such as other projects' memory files, are not transcripts.
  const writtenSessionIds = Stream.filterMap(Stream.unwrap(watchClaudeProjects()), (fileSystemEvent) =>
    decodeSessionId(path.basename(fileSystemEvent.path, ".jsonl"))
  );

  return Stream.groupedWithin(Stream.merge(trackedSessionIds, writtenSessionIds), 64, "300 millis");
});

// ~/.claude/projects does not exist until Claude's first run, so the watcher keeps trying.
export const watchTranscripts = Effect.fn("ClaudeCodeHarnessClient.watchTranscripts")(
  function* (titleTracking: TitleTracking) {
    const sessionIdBatches = yield* watchSessionIdBatches(titleTracking.trackedSessions);
    yield* Stream.runForEach(sessionIdBatches, (sessionIds) => refreshSessionTitles(titleTracking, sessionIds));
  },
  Effect.tapError((watchError) =>
    Effect.logWarning("Could not watch Claude's transcripts; retrying in 30s", watchError)
  ),
  Effect.retry(Schedule.spaced("30 seconds"))
);

export const getSessionTitle = Effect.fn("ClaudeCodeHarnessClient.getSessionTitle")(function* (
  sessionTitles: SessionTitlesReference,
  sessionId: SessionId
) {
  const currentTitles = yield* SubscriptionRef.get(sessionTitles);

  return yield* Effect.fromResult(
    Result.fromNullishOr(currentTitles.get(sessionId), () => new SessionTitleNotFound({sessionId}))
  );
});

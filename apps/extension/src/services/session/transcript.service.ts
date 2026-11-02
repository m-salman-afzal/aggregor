import {SessionTitleNotFound} from "@/errors/session.error.ts";
import {SessionStore} from "@/services/session/store.service.ts";
import {
  findTranscriptFilePath,
  getClaudeProjectsDirectoryPath,
  getPreferredTitle,
  NO_TITLES,
  readNewTitles
} from "@/services/session/transcript.utils.ts";
import {Context, Effect, Layer, Result, Schedule, Stream, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

import type {TitleNotFound} from "@/errors/session.error.ts";
import type {TranscriptProgress} from "@/services/session/transcript.utils.ts";

const makeTranscriptService = Effect.fn("TranscriptService.make")(function* () {
  const fileSystem = yield* FileSystem;
  const path = yield* Path;
  const {sessions} = yield* SessionStore;
  const sessionTitles = yield* SubscriptionRef.make<ReadonlyMap<string, string>>(new Map());
  const transcriptProgressBySessionId = new Map<string, TranscriptProgress>();

  const getTranscriptProgress = Effect.fn("TranscriptService.getTranscriptProgress")(function* (sessionId: string) {
    const knownProgress = transcriptProgressBySessionId.get(sessionId);
    if (knownProgress !== undefined) return knownProgress;

    const transcriptFilePath = yield* findTranscriptFilePath(sessionId);
    const freshProgress: TranscriptProgress = {byteOffset: 0n, titles: NO_TITLES, transcriptFilePath};

    return freshProgress;
  });

  // Only publishes real changes, since Claude writes to its transcript many times per turn.
  const publishSessionTitle = Effect.fn("TranscriptService.publishSessionTitle")(function* (
    sessionId: string,
    sessionTitle: Result.Result<string, TitleNotFound>
  ) {
    const currentTitles = yield* SubscriptionRef.get(sessionTitles);
    if (Result.isFailure(sessionTitle) || currentTitles.get(sessionId) === sessionTitle.success) return;

    yield* SubscriptionRef.set(sessionTitles, new Map(currentTitles).set(sessionId, sessionTitle.success));
  });

  const refreshSessionTitle = Effect.fn("TranscriptService.refreshSessionTitle")(function* (sessionId: string) {
    const knownProgress = yield* getTranscriptProgress(sessionId);
    const {size: transcriptSize} = yield* fileSystem.stat(knownProgress.transcriptFilePath);
    // A transcript that shrank was rewritten, so read it again from the start.
    const startingProgress =
      transcriptSize < knownProgress.byteOffset ? {...knownProgress, byteOffset: 0n, titles: NO_TITLES} : knownProgress;
    const nextProgress = yield* readNewTitles(startingProgress, transcriptSize);

    yield* Effect.sync(() => transcriptProgressBySessionId.set(sessionId, nextProgress));
    yield* publishSessionTitle(sessionId, getPreferredTitle(nextProgress.titles));
  });

  // The watcher sees every Claude session on this machine; only ours are read. A session has no transcript until
  // its first message.
  const refreshTrackedSessionTitle = Effect.fn("TranscriptService.refreshTrackedSessionTitle")(
    function* (sessionId: string) {
      const trackedSessions = yield* SubscriptionRef.get(sessions);
      if (!trackedSessions.some((session) => session.id === sessionId)) return;

      yield* refreshSessionTitle(sessionId);
    },
    Effect.catchTag("TranscriptNotFound", () => Effect.void),
    (effect, sessionId) =>
      Effect.ignore(effect, {log: "Warn", message: `Could not read the title of session ${sessionId}`})
  );

  const refreshSessionTitles = Effect.fn("TranscriptService.refreshSessionTitles")(function* (
    sessionIds: readonly string[]
  ) {
    for (const sessionId of new Set(sessionIds)) yield* refreshTrackedSessionTitle(sessionId);
  });

  const watchClaudeProjects = Effect.fn("TranscriptService.watchClaudeProjects")(function* () {
    const projectsDirectoryPath = yield* getClaudeProjectsDirectoryPath();

    return fileSystem.watch(projectsDirectoryPath, {recursive: true});
  });

  // Every tracked session once per list change (which also covers startup), plus each transcript Claude writes.
  const trackedSessionIds = Stream.flatMap(SubscriptionRef.changes(sessions), (trackedSessions) =>
    Stream.fromIterable(trackedSessions.map((session) => session.id))
  );
  const writtenSessionIds = Stream.map(Stream.unwrap(watchClaudeProjects()), (fileSystemEvent) =>
    path.basename(fileSystemEvent.path, ".jsonl")
  );
  const sessionIdBatches = Stream.groupedWithin(Stream.merge(trackedSessionIds, writtenSessionIds), 64, "300 millis");

  // ~/.claude/projects does not exist until Claude's first run, so the watcher keeps trying.
  const watchTranscripts = Effect.fn("TranscriptService.watchTranscripts")(
    function* () {
      yield* Stream.runForEach(sessionIdBatches, refreshSessionTitles);
    },
    Effect.tapError((watchError) =>
      Effect.logWarning("Could not watch Claude's transcripts; retrying in 30s", watchError)
    ),
    Effect.retry(Schedule.spaced("30 seconds"))
  );
  yield* Effect.forkScoped(watchTranscripts());

  const getSessionTitle = Effect.fn("TranscriptService.getSessionTitle")(function* (sessionId: string) {
    const currentTitles = yield* SubscriptionRef.get(sessionTitles);

    return yield* Effect.fromResult(
      Result.fromNullishOr(currentTitles.get(sessionId), () => new SessionTitleNotFound({sessionId}))
    );
  });

  return {getSessionTitle, sessionTitles};
});

// The names Claude gives our sessions, read from its transcripts and kept current while Claude writes to them.
export class TranscriptService extends Context.Service<
  TranscriptService,
  {
    readonly getSessionTitle: (sessionId: string) => Effect.Effect<string, SessionTitleNotFound>;
    readonly sessionTitles: SubscriptionRef.SubscriptionRef<ReadonlyMap<string, string>>;
  }
>()("aggregor/services/session/transcript.service/TranscriptService") {
  public static readonly layer = Layer.effect(TranscriptService, makeTranscriptService());
}

import {SessionStore} from "@/services/session/store.service.ts";
import {
  findTranscriptFilePath,
  getClaudeProjectsDirectoryPath,
  getPreferredTitle,
  NO_TITLES,
  readNewTitles
} from "@/services/session/transcript.utils.ts";
import {Context, Effect, Layer, Option, Schedule, Stream, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

import type {TranscriptProgress} from "@/services/session/transcript.utils.ts";

// The names Claude gives our sessions, read from its transcripts and kept current while Claude writes to them.
export class TranscriptService extends Context.Service<
  TranscriptService,
  {
    readonly getSessionTitle: (sessionId: string) => Effect.Effect<Option.Option<string>>;
    readonly sessionTitles: SubscriptionRef.SubscriptionRef<ReadonlyMap<string, string>>;
  }
>()("aggregor/services/session/transcript.service/TranscriptService") {
  public static readonly layer = Layer.effect(
    TranscriptService,
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem;
      const path = yield* Path;
      const {sessions} = yield* SessionStore;
      const sessionTitles = yield* SubscriptionRef.make<ReadonlyMap<string, string>>(new Map());
      const transcriptProgressBySessionId = new Map<string, TranscriptProgress>();

      const getTranscriptProgress = Effect.fn("TranscriptService.getTranscriptProgress")(function* (sessionId: string) {
        const knownProgress = Option.fromNullishOr(transcriptProgressBySessionId.get(sessionId));
        if (Option.isSome(knownProgress)) return knownProgress.value;

        const transcriptFilePath = yield* findTranscriptFilePath(sessionId);
        const freshProgress: TranscriptProgress = {byteOffset: 0n, titles: NO_TITLES, transcriptFilePath};

        return freshProgress;
      });

      // Only publishes real changes, since Claude writes to its transcript many times per turn.
      const publishSessionTitle = Effect.fn("TranscriptService.publishSessionTitle")(function* (
        sessionId: string,
        sessionTitle: Option.Option<string>
      ) {
        const currentTitles = yield* SubscriptionRef.get(sessionTitles);
        if (Option.isNone(sessionTitle) || currentTitles.get(sessionId) === sessionTitle.value) return;

        yield* SubscriptionRef.set(sessionTitles, new Map(currentTitles).set(sessionId, sessionTitle.value));
      });

      const refreshSessionTitle = Effect.fn("TranscriptService.refreshSessionTitle")(function* (sessionId: string) {
        const knownProgress = yield* getTranscriptProgress(sessionId);
        const {size: transcriptSize} = yield* fileSystem.stat(knownProgress.transcriptFilePath);
        // A transcript that shrank was rewritten, so read it again from the start.
        const startingProgress =
          transcriptSize < knownProgress.byteOffset
            ? {...knownProgress, byteOffset: 0n, titles: NO_TITLES}
            : knownProgress;
        const nextProgress = yield* readNewTitles(startingProgress, transcriptSize);

        yield* Effect.sync(() => transcriptProgressBySessionId.set(sessionId, nextProgress));
        yield* publishSessionTitle(sessionId, getPreferredTitle(nextProgress.titles));
      });

      // The watcher sees every Claude session on this machine; only ours are read.
      const refreshTrackedSessionTitle = Effect.fn("TranscriptService.refreshTrackedSessionTitle")(function* (
        sessionId: string
      ) {
        const trackedSessions = yield* SubscriptionRef.get(sessions);
        if (!trackedSessions.some((session) => session.id === sessionId)) return;

        yield* refreshSessionTitle(sessionId);
      });

      const refreshSessionTitles = Effect.fn("TranscriptService.refreshSessionTitles")(function* (
        sessionIds: readonly string[]
      ) {
        // A session has no transcript until its first message.
        for (const sessionId of new Set(sessionIds)) {
          yield* refreshTrackedSessionTitle(sessionId).pipe(
            Effect.catchTag("TranscriptNotFound", () => Effect.void),
            Effect.ignore({log: "Warn", message: `Could not read the title of session ${sessionId}`})
          );
        }
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
      const sessionIdBatches = Stream.groupedWithin(
        Stream.merge(trackedSessionIds, writtenSessionIds),
        64,
        "300 millis"
      );

      yield* Effect.forkScoped(
        // ~/.claude/projects does not exist until Claude's first run, so the watcher keeps trying.
        Stream.runForEach(sessionIdBatches, refreshSessionTitles).pipe(
          Effect.tapError((watchError) =>
            Effect.logWarning("Could not watch Claude's transcripts; retrying in 30s", watchError)
          ),
          Effect.retry(Schedule.spaced("30 seconds"))
        )
      );

      const getSessionTitle = Effect.fn("TranscriptService.getSessionTitle")(function* (sessionId: string) {
        const currentTitles = yield* SubscriptionRef.get(sessionTitles);

        return Option.fromNullishOr(currentTitles.get(sessionId));
      });

      return TranscriptService.of({getSessionTitle, sessionTitles});
    })
  );
}

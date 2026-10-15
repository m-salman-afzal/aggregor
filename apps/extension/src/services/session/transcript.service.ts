import {SessionStore} from "@/services/session/store.service.ts";
import {findTranscript, getProjectsDir, NO_TITLES, readTitles, titleOf} from "@/services/session/transcript.utils.ts";
import {Context, Effect, Layer, Option, Schedule, Stream, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

import type {TranscriptProgress} from "@/services/session/transcript.utils.ts";

// The names Claude gives our sessions, read from its transcripts and kept current while Claude writes to them.
export class TranscriptService extends Context.Service<
  TranscriptService,
  {
    readonly titleOf: (id: string) => Effect.Effect<Option.Option<string>>;
    readonly titles: SubscriptionRef.SubscriptionRef<ReadonlyMap<string, string>>;
  }
>()("aggregor/services/session/transcript.service/TranscriptService") {
  public static readonly layer = Layer.effect(
    TranscriptService,
    Effect.gen(function* () {
      const fs = yield* FileSystem;
      const path = yield* Path;
      const {sessions} = yield* SessionStore;
      const titles = yield* SubscriptionRef.make<ReadonlyMap<string, string>>(new Map());
      const progress = new Map<string, TranscriptProgress>();

      const getProgress = Effect.fn("getProgress")(function* (id: string) {
        const known = Option.fromNullishOr(progress.get(id));
        if (Option.isSome(known)) return known.value;

        const file = yield* findTranscript(id);
        const fresh: TranscriptProgress = {file, offset: 0n, titles: NO_TITLES};

        return fresh;
      });

      // Only publishes real changes, since Claude writes to its transcript many times per turn.
      const publishTitle = Effect.fn("publishTitle")(function* (id: string, title: Option.Option<string>) {
        const current = yield* SubscriptionRef.get(titles);
        if (Option.isNone(title) || current.get(id) === title.value) return;

        yield* SubscriptionRef.set(titles, new Map(current).set(id, title.value));
      });

      const refreshTitle = Effect.fn("refreshTitle")(function* (id: string) {
        const known = yield* getProgress(id);
        const {size} = yield* fs.stat(known.file);
        // A transcript that shrank was rewritten, so read it again from the start.
        const from = size < known.offset ? {...known, offset: 0n, titles: NO_TITLES} : known;
        const next = yield* readTitles(from, size);

        yield* Effect.sync(() => progress.set(id, next));
        yield* publishTitle(id, titleOf(next.titles));
      });

      // The watcher sees every Claude session on this machine; only ours are read.
      const refreshIfTracked = Effect.fn("refreshIfTracked")(function* (id: string) {
        const all = yield* SubscriptionRef.get(sessions);
        if (!all.some((session) => session.id === id)) return;

        yield* refreshTitle(id);
      });

      const refreshBatch = Effect.fn("refreshBatch")(function* (ids: readonly string[]) {
        for (const id of new Set(ids)) yield* Effect.ignore(refreshIfTracked(id));
      });

      const watchProjects = Effect.fn("watchProjects")(function* () {
        const projects = yield* getProjectsDir();

        return fs.watch(projects, {recursive: true});
      });

      // Every tracked session once per list change (which also covers startup), plus each transcript Claude writes.
      const sessionIds = Stream.flatMap(SubscriptionRef.changes(sessions), (all) =>
        Stream.fromIterable(all.map((session) => session.id))
      );
      const writtenIds = Stream.map(Stream.unwrap(watchProjects()), (event) => path.basename(event.path, ".jsonl"));
      const batches = Stream.groupedWithin(Stream.merge(sessionIds, writtenIds), 64, "300 millis");

      yield* Effect.forkScoped(
        // ~/.claude/projects does not exist until Claude's first run, so the watcher keeps trying.
        Stream.runForEach(batches, refreshBatch).pipe(Effect.retry(Schedule.spaced("30 seconds")))
      );

      const titleOfSession = Effect.fn("titleOf")(function* (id: string) {
        const current = yield* SubscriptionRef.get(titles);

        return Option.fromNullishOr(current.get(id));
      });

      return TranscriptService.of({titleOf: titleOfSession, titles});
    })
  );
}

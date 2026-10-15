import {TranscriptNotFound} from "@/errors/session.error.ts";
import {ByteSize, Config, Effect, Option, Result, Schema, Stream} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";
import {homedir} from "node:os";

// Claude appends one of these every time it (re)names a conversation. The format is undocumented, so anything that
// stops matching just leaves the session with our own name.
const TitleEntry = Schema.Union([
  Schema.Struct({aiTitle: Schema.String, type: Schema.Literal("ai-title")}),
  Schema.Struct({customTitle: Schema.String, type: Schema.Literal("custom-title")})
]);

const decodeTitleLine = Schema.decodeUnknownResult(Schema.fromJsonString(TitleEntry));

export interface Titles {
  readonly ai: Option.Option<string>;
  readonly custom: Option.Option<string>;
}

// How far into a transcript we have read, so each refresh only scans what Claude appended since.
export interface TranscriptProgress {
  readonly file: string;
  readonly offset: bigint;
  readonly titles: Titles;
}

export const NO_TITLES: Titles = {ai: Option.none(), custom: Option.none()};

export const getProjectsDir = Effect.fn("getProjectsDir")(function* () {
  const path = yield* Path;
  const configDir = yield* Config.withDefault(Config.String("CLAUDE_CONFIG_DIR"), path.join(homedir(), ".claude"));

  return path.join(configDir, "projects");
});

// Claude writes <projects>/<encoded cwd>/<id>.jsonl after the first message. Scanning every project folder
// instead of encoding the cwd ourselves keeps symlinked and very long paths working.
export const findTranscript = Effect.fn("findTranscript")(function* (id: string) {
  const fs = yield* FileSystem;
  const path = yield* Path;
  const projects = yield* getProjectsDir();
  const folders = yield* fs.readDirectory(projects);
  const found = yield* Effect.findFirst(folders, (folder) => fs.exists(path.join(projects, folder, `${id}.jsonl`)));
  const folder = yield* Effect.fromResult(Result.fromOption(found, () => new TranscriptNotFound({id})));

  return path.join(projects, folder, `${id}.jsonl`);
});

// A custom title (/rename) beats Claude's own; within each kind the latest wins.
export const titleOf = (titles: Titles) => Option.orElse(titles.custom, () => titles.ai);

const addTitle = (current: Titles, entry: typeof TitleEntry.Type): Titles =>
  entry.type === "ai-title"
    ? {...current, ai: Option.some(entry.aiTitle)}
    : {...current, custom: Option.some(entry.customTitle)};

// Scans the bytes between the last read and `size`. A line cut off by a concurrent write is never a title: titles
// are short lines written in one go.
export const readTitles = Effect.fn("readTitles")(function* (progress: TranscriptProgress, size: bigint) {
  const fs = yield* FileSystem;
  const titles = yield* Stream.decodeText(
    fs.stream(progress.file, {bytesToRead: ByteSize.bytes(size - progress.offset), offset: progress.offset})
  ).pipe(
    Stream.splitLines,
    Stream.filter((line) => line.includes('-title"')),
    Stream.filterMap((line) => decodeTitleLine(line)),
    Stream.runFold(() => progress.titles, addTitle)
  );

  return {...progress, offset: size, titles};
});

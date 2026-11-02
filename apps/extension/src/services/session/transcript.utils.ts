import {TitleNotFound, TranscriptNotFound} from "@/errors/session.error.ts";
import {ByteSize, Config, Effect, Result, Schema, Stream} from "effect";
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

// How far into a transcript we have read, so each refresh only scans what Claude appended since.
export interface TranscriptProgress {
  readonly byteOffset: bigint;
  readonly titles: Titles;
  readonly transcriptFilePath: string;
}

interface Titles {
  readonly aiTitle: Result.Result<string, TitleNotFound>;
  readonly customTitle: Result.Result<string, TitleNotFound>;
}

export const NO_TITLES: Titles = {
  aiTitle: Result.fail(new TitleNotFound()),
  customTitle: Result.fail(new TitleNotFound())
};

export const getClaudeProjectsDirectoryPath = Effect.fn("getClaudeProjectsDirectoryPath")(function* () {
  const path = yield* Path;
  const claudeConfigDirectoryPath = yield* Config.withDefault(
    Config.String("CLAUDE_CONFIG_DIR"),
    path.join(homedir(), ".claude")
  );

  return path.join(claudeConfigDirectoryPath, "projects");
});

// Claude writes <projects>/<encoded cwd>/<session id>.jsonl after the first message. Scanning every project folder
// instead of encoding the cwd ourselves keeps symlinked and very long paths working.
export const findTranscriptFilePath = Effect.fn("findTranscriptFilePath")(function* (sessionId: string) {
  const fileSystem = yield* FileSystem;
  const path = yield* Path;
  const projectsDirectoryPath = yield* getClaudeProjectsDirectoryPath();
  const projectFolderNames = yield* fileSystem.readDirectory(projectsDirectoryPath);
  const matchingFolderName = yield* Effect.findFirst(projectFolderNames, (projectFolderName) =>
    fileSystem.exists(path.join(projectsDirectoryPath, projectFolderName, `${sessionId}.jsonl`))
  );
  const projectFolderName = yield* Effect.fromResult(
    Result.fromOption(matchingFolderName, () => new TranscriptNotFound({sessionId}))
  );

  return path.join(projectsDirectoryPath, projectFolderName, `${sessionId}.jsonl`);
});

// A custom title (/rename) beats Claude's own; within each kind the latest wins.
export const getPreferredTitle = (titles: Titles) => Result.orElse(titles.customTitle, () => titles.aiTitle);

const addTitleEntry = (currentTitles: Titles, titleEntry: typeof TitleEntry.Type): Titles =>
  titleEntry.type === "ai-title"
    ? {...currentTitles, aiTitle: Result.succeed(titleEntry.aiTitle)}
    : {...currentTitles, customTitle: Result.succeed(titleEntry.customTitle)};

// Scans the bytes between the last read and `transcriptSize`. A line cut off by a concurrent write is never a title:
// titles are short lines written in one go.
export const readNewTitles = Effect.fn("readNewTitles")(function* (
  transcriptProgress: TranscriptProgress,
  transcriptSize: bigint
) {
  const fileSystem = yield* FileSystem;
  const updatedTitles = yield* Stream.decodeText(
    fileSystem.stream(transcriptProgress.transcriptFilePath, {
      bytesToRead: ByteSize.bytes(transcriptSize - transcriptProgress.byteOffset),
      offset: transcriptProgress.byteOffset
    })
  ).pipe(
    Stream.splitLines,
    Stream.filter((transcriptLine) => transcriptLine.includes('-title"')),
    Stream.filterMap((transcriptLine) => decodeTitleLine(transcriptLine)),
    Stream.runFold(() => transcriptProgress.titles, addTitleEntry)
  );

  return {...transcriptProgress, byteOffset: transcriptSize, titles: updatedTitles};
});

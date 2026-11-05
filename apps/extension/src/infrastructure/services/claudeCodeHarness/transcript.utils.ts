import {addTitleEntry, decodeTitleLine} from "@infraServices/claudeCodeHarness/claudeCode.transformer.ts";
import {SessionIdValueObjectSchema} from "@valueObjects/sessionId.valueObject.ts";
import {ByteSize, Config, Effect, Result, Schema, Stream} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";
import {homedir} from "node:os";

import type {TranscriptProgress} from "@infraServices/claudeCodeHarness/claudeCodeHarness.infraService.type.ts";
import type {SessionIdValueObject} from "@valueObjects/sessionId.valueObject.ts";

export class TranscriptNotFoundError extends Schema.TaggedError<
  TranscriptNotFoundError,
  {readonly brand: unique symbol}
>()("TranscriptNotFoundError", {sessionId: SessionIdValueObjectSchema}) {}

export const getClaudeProjectsDirectoryPath = Effect.fn("ClaudeCodeHarnessInfraService.getClaudeProjectsDirectoryPath")(
  function* () {
    const path = yield* Path;
    const claudeConfigDirectoryPath = yield* Config.withDefault(
      Config.String("CLAUDE_CONFIG_DIR"),
      path.join(homedir(), ".claude")
    );

    return path.join(claudeConfigDirectoryPath, "projects");
  }
);

// Claude writes <projects>/<encoded cwd>/<session id>.jsonl after the first message. Scanning every project folder
// instead of encoding the cwd ourselves keeps symlinked and very long paths working.
export const findTranscriptFilePath = Effect.fn("ClaudeCodeHarnessInfraService.findTranscriptFilePath")(function* (
  sessionId: SessionIdValueObject
) {
  const fileSystem = yield* FileSystem;
  const path = yield* Path;
  const projectsDirectoryPath = yield* getClaudeProjectsDirectoryPath();
  const projectFolderNames = yield* fileSystem.readDirectory(projectsDirectoryPath);
  const matchingFolderName = yield* Effect.findFirst(projectFolderNames, (projectFolderName) =>
    fileSystem.exists(path.join(projectsDirectoryPath, projectFolderName, `${sessionId}.jsonl`))
  );
  const projectFolderName = yield* Effect.fromResult(
    Result.fromOption(matchingFolderName, () => TranscriptNotFoundError.make({sessionId}))
  );

  return path.join(projectsDirectoryPath, projectFolderName, `${sessionId}.jsonl`);
});

// Scans the bytes between the last read and `transcriptSize`. A line cut off by a concurrent write is never a title:
// titles are short lines written in one go.
export const readNewTitles = Effect.fn("ClaudeCodeHarnessInfraService.readNewTitles")(function* (
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
    Stream.filterMap((transcriptLine) => decodeTitleLine(transcriptLine)),
    Stream.runFoldEffect(() => transcriptProgress.titles, addTitleEntry)
  );

  return {...transcriptProgress, byteOffset: transcriptSize, titles: updatedTitles};
});

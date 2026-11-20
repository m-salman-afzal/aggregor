import {NodeServices} from "@effect/platform-node";
import {AGENT_HISTORY_TITLE} from "@pkg/constants/src/agentHistory.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Array, Config, Context, Effect, Layer, Result, Schema, String} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";
import {homedir} from "node:os";

import type {FileSlice} from "@infraServices/agentHistory/agentHistory.infraService.type.ts";

export class AgentHistoryUtils extends Context.Service<AgentHistoryUtils>()(
  "aggregor-app/infrastructure/services/agentHistory/agentHistory.utils/AgentHistoryUtils",
  {
    make: Effect.fn("make")(function* () {
      const fileSystem = yield* FileSystem;
      const path = yield* Path;
      const homeFolderPath = homedir();

      // A variable the agent reads to move its store, or the folder it defaults to under the home folder.
      const readFolderFromEnvironment = Effect.fn("readFolderFromEnvironment")(function* (
        environmentVariable: string,
        defaultFolderName: string
      ) {
        const configuredFolder = yield* Config.withDefault(Config.String(environmentVariable), "");

        return configuredFolder === "" ? path.join(homeFolderPath, defaultFolderName) : configuredFolder;
      }, Effect.orDie);

      // From position for at most byteCount bytes; a file shorter than that reads what it has.
      const readFileSlice = Effect.fn("readFileSlice")(function* (fileSlice: FileSlice) {
        const openedFile = yield* fileSystem.open(fileSlice.filePath, {flag: "r"});
        const readBytes = yield* openedFile.readAlloc(fileSlice.byteCount, {position: fileSlice.position});

        return Result.match(
          Result.fromOption(readBytes, () => undefined),
          {onFailure: () => "", onSuccess: (bytes) => new TextDecoder().decode(bytes)}
        );
      }, Effect.scoped);

      // The last byteCount bytes; its first line is usually cut, and fails to parse like any other broken line.
      const readFileTail = Effect.fn("readFileTail")(function* (filePath: string, byteCount: number) {
        const fileInfo = yield* fileSystem.stat(filePath);
        const tailStart = fileInfo.size > BigInt(byteCount) ? fileInfo.size - BigInt(byteCount) : 0n;

        return yield* readFileSlice({byteCount, filePath, position: tailStart});
      });

      // Lines that aren't whole JSON in the schema's shape are left out.
      const decodeJsonLines = Effect.fn("decodeJsonLines")(function* <LineType>(
        lineSchema: Schema.Codec<LineType, string>,
        jsonLines: string
      ) {
        return Array.getSuccesses(
          Array.map(String.split("\n")(jsonLines), (jsonLine) => Schema.decodeResult(lineSchema)(jsonLine))
        );
      });

      const toOneLineTitle = Effect.fn("toOneLineTitle")(function* (text: string) {
        const oneLineText = String.trim(String.replaceAll(AGENT_HISTORY_TITLE.LINE_BREAKS, " ")(text));

        return oneLineText.length > AGENT_HISTORY_TITLE.MAX_LENGTH
          ? `${String.trimEnd(String.slice(0, AGENT_HISTORY_TITLE.MAX_LENGTH)(oneLineText))}…`
          : oneLineText;
      });

      return {decodeJsonLines, readFileSlice, readFileTail, readFolderFromEnvironment, toOneLineTitle};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("AgentHistoryUtils", this.make())).pipe(
    Layer.provide(NodeServices.layer)
  );
}

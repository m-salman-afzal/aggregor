import {homedir} from "node:os";

import {NodeServices} from "@effect/platform-node";
import {Array, Config, Context, Effect, Layer, Result, Schema, String} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

import {AGENT_HISTORY_TITLE} from "@pkg/constants/src/agentHistory.constant.ts";

import type {FileSlice} from "@/infraServices/agentHistory/agentHistory.infraService.type.ts";

export class AgentHistoryUtils extends Context.Service<AgentHistoryUtils>()(
  "aggregor-app/infrastructure/services/agentHistory/agentHistory.utils/AgentHistoryUtils",
  {
    make: Effect.fn("AgentHistoryUtils.make")(function* () {
      const fileSystem = yield* FileSystem;
      const path = yield* Path;
      const homeFolderPath = homedir();

      const readFolderFromEnvironment = Effect.fn("AgentHistoryUtils.readFolderFromEnvironment")(function* (
        environmentVariable: string,
        defaultFolderName: string
      ) {
        const configuredFolder = yield* Config.withDefault(Config.String(environmentVariable), "");

        return configuredFolder === "" ? path.join(homeFolderPath, defaultFolderName) : configuredFolder;
      }, Effect.orDie);

      const readFileSlice = Effect.fn("AgentHistoryUtils.readFileSlice")(function* (fileSlice: FileSlice) {
        const openedFile = yield* fileSystem.open(fileSlice.filePath, {flag: "r"});
        const readBytes = yield* openedFile.readAlloc(fileSlice.byteCount, {position: fileSlice.position});

        return Result.match(
          Result.fromOption(readBytes, () => undefined),
          {onFailure: () => "", onSuccess: (bytes) => new TextDecoder().decode(bytes)}
        );
      }, Effect.scoped);

      // The last byteCount bytes; its first line is usually cut, and fails to parse like any other broken line.
      const readFileTail = Effect.fn("AgentHistoryUtils.readFileTail")(function* (filePath: string, byteCount: number) {
        const fileInfo = yield* fileSystem.stat(filePath);
        const tailStart = fileInfo.size > BigInt(byteCount) ? fileInfo.size - BigInt(byteCount) : 0n;

        return yield* readFileSlice({byteCount, filePath, position: tailStart});
      });

      const decodeJsonLines = Effect.fn("AgentHistoryUtils.decodeJsonLines")(function* <LineType>(
        lineSchema: Schema.Codec<LineType, string>,
        jsonLines: string
      ) {
        return Array.getSuccesses(
          Array.map(String.split("\n")(jsonLines), (jsonLine) => Schema.decodeResult(lineSchema)(jsonLine))
        );
      });

      const formatTextAsOneLineTitle = Effect.fn("AgentHistoryUtils.formatTextAsOneLineTitle")(function* (
        text: string
      ) {
        const oneLineText = String.trim(String.replaceAll(AGENT_HISTORY_TITLE.LINE_BREAKS, " ")(text));

        return oneLineText.length > AGENT_HISTORY_TITLE.MAX_LENGTH
          ? `${String.trimEnd(String.slice(0, AGENT_HISTORY_TITLE.MAX_LENGTH)(oneLineText))}…`
          : oneLineText;
      });

      return {decodeJsonLines, formatTextAsOneLineTitle, readFileSlice, readFileTail, readFolderFromEnvironment};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(Layer.provide(NodeServices.layer));
}

import {AGENT_HISTORY_TITLE} from "@pkg/constants/src/agentHistory.constant.ts";
import {Array, Config, Effect, Result, Schema, String} from "effect";

import type {AgentHistoryDependencies, FileSlice} from "@infraServices/agentHistory/agentHistory.infraService.type.ts";

// A variable the agent reads to move its store, or the folder it defaults to under the home folder.
export const readFolderFromEnvironment = Effect.fn("AgentHistoryInfraService.readFolderFromEnvironment")(function* (
  agentHistoryDependencies: AgentHistoryDependencies,
  environmentVariable: string,
  defaultFolderName: string
) {
  const configuredFolder = yield* Config.withDefault(Config.String(environmentVariable), "");

  return configuredFolder === ""
    ? agentHistoryDependencies.path.join(agentHistoryDependencies.homeFolderPath, defaultFolderName)
    : configuredFolder;
}, Effect.orDie);

// From position for at most byteCount bytes; a file shorter than that reads what it has.
export const readFileSlice = Effect.fn("AgentHistoryInfraService.readFileSlice")(function* (
  agentHistoryDependencies: AgentHistoryDependencies,
  fileSlice: FileSlice
) {
  const openedFile = yield* agentHistoryDependencies.fileSystem.open(fileSlice.filePath, {flag: "r"});
  const readBytes = yield* openedFile.readAlloc(fileSlice.byteCount, {position: fileSlice.position});

  return Result.match(
    Result.fromOption(readBytes, () => undefined),
    {onFailure: () => "", onSuccess: (bytes) => new TextDecoder().decode(bytes)}
  );
}, Effect.scoped);

// The last byteCount bytes; its first line is usually cut, and fails to parse like any other broken line.
export const readFileTail = Effect.fn("AgentHistoryInfraService.readFileTail")(function* (
  agentHistoryDependencies: AgentHistoryDependencies,
  filePath: string,
  byteCount: number
) {
  const fileInfo = yield* agentHistoryDependencies.fileSystem.stat(filePath);
  const tailStart = fileInfo.size > BigInt(byteCount) ? fileInfo.size - BigInt(byteCount) : 0n;

  return yield* readFileSlice(agentHistoryDependencies, {byteCount, filePath, position: tailStart});
});

// Lines that aren't whole JSON in the schema's shape are left out.
export const decodeJsonLines = Effect.fn("AgentHistoryInfraService.decodeJsonLines")(function* <LineType>(
  lineSchema: Schema.Codec<LineType, string>,
  jsonLines: string
) {
  return Array.getSuccesses(
    Array.map(String.split("\n")(jsonLines), (jsonLine) => Schema.decodeResult(lineSchema)(jsonLine))
  );
});

export const toOneLineTitle = Effect.fn("AgentHistoryInfraService.toOneLineTitle")(function* (text: string) {
  const oneLineText = String.trim(String.replaceAll(AGENT_HISTORY_TITLE.LINE_BREAKS, " ")(text));

  return oneLineText.length > AGENT_HISTORY_TITLE.MAX_LENGTH
    ? `${String.trimEnd(String.slice(0, AGENT_HISTORY_TITLE.MAX_LENGTH)(oneLineText))}…`
    : oneLineText;
});

import {
  decodeJsonLines,
  readFileSlice,
  readFileTail,
  readFolderFromEnvironment,
  toOneLineTitle
} from "@infraServices/agentHistory/agentHistory.utils.ts";
import {CLAUDE_HISTORY, CLAUDE_HISTORY_LINE_TYPES} from "@pkg/constants/src/agentHistory.constant.ts";
import {Array, Effect, Result, Schema, String} from "effect";

import type {AgentHistoryDependencies} from "@infraServices/agentHistory/agentHistory.infraService.type.ts";
import type {AgentConversation} from "@interfaces/agentHistory.infraService.interface.ts";

const ClaudeHistoryLineJson = Schema.fromJsonString(
  Schema.Struct({
    aiTitle: Schema.optional(Schema.String),
    customTitle: Schema.optional(Schema.String),
    isMeta: Schema.optional(Schema.Boolean),
    message: Schema.optional(
      Schema.Struct({
        content: Schema.Union([
          Schema.String,
          Schema.Array(Schema.Struct({text: Schema.optional(Schema.String), type: Schema.String}))
        ])
      })
    ),
    type: Schema.String
  })
);

type ClaudeHistoryLine = typeof ClaudeHistoryLineJson.Type;

// A rename beats the generated title, and the latest of each wins.
const findClaudeTitle = Effect.fn("AgentHistoryInfraService.findClaudeTitle")(function* (
  tailLines: readonly ClaudeHistoryLine[]
) {
  const customTitles = Array.flatMap(tailLines, (historyLine) =>
    historyLine.customTitle === undefined ? [] : [historyLine.customTitle]
  );
  const aiTitles = Array.flatMap(tailLines, (historyLine) =>
    historyLine.aiTitle === undefined ? [] : [historyLine.aiTitle]
  );
  const latestCustomTitle = customTitles.at(-1);

  return Result.fromNullishOr(latestCustomTitle === undefined ? aiTitles.at(-1) : latestCustomTitle, () => undefined);
});

const readPromptText = Effect.fn("AgentHistoryInfraService.readPromptText")(function* (historyLine: ClaudeHistoryLine) {
  if (historyLine.type !== CLAUDE_HISTORY_LINE_TYPES.USER || historyLine.isMeta === true) return "";
  if (historyLine.message === undefined) return "";
  const messageContent = historyLine.message.content;
  const promptText = String.trim(
    typeof messageContent === "string"
      ? messageContent
      : Array.join(
          Array.flatMap(messageContent, (contentPart) => (contentPart.text === undefined ? [] : [contentPart.text])),
          " "
        )
  );

  return String.startsWith(CLAUDE_HISTORY.COMMAND_MARKUP_PREFIX)(promptText) ? "" : promptText;
});

const findFirstPrompt = Effect.fn("AgentHistoryInfraService.findFirstPrompt")(function* (
  headLines: readonly ClaudeHistoryLine[]
) {
  const promptTexts = yield* Effect.forEach(headLines, readPromptText);

  return Result.fromOption(
    Array.findFirst(promptTexts, (promptText) => promptText !== ""),
    () => undefined
  );
});

const readClaudeTitleText = Effect.fn("AgentHistoryInfraService.readClaudeTitleText")(function* (
  agentHistoryDependencies: AgentHistoryDependencies,
  conversationFilePath: string
) {
  const headText = yield* readFileSlice(agentHistoryDependencies, {
    byteCount: CLAUDE_HISTORY.HEAD_BYTES,
    filePath: conversationFilePath,
    position: 0n
  });
  const tailText = yield* readFileTail(agentHistoryDependencies, conversationFilePath, CLAUDE_HISTORY.TAIL_BYTES);
  const headLines = yield* decodeJsonLines(ClaudeHistoryLineJson, headText);
  const tailLines = yield* decodeJsonLines(ClaudeHistoryLineJson, tailText);
  const claudeTitle = yield* findClaudeTitle(tailLines);
  const firstPrompt = yield* findFirstPrompt(headLines);

  return Result.orElse(claudeTitle, () => firstPrompt);
});

// A conversation with neither a title nor a prompt never got going, and isn't offered.
const readClaudeConversation = Effect.fn("AgentHistoryInfraService.readClaudeConversation")(function* (
  agentHistoryDependencies: AgentHistoryDependencies,
  conversationFilePath: string
) {
  const fileInfo = yield* agentHistoryDependencies.fileSystem.stat(conversationFilePath);
  const titleText = yield* readClaudeTitleText(agentHistoryDependencies, conversationFilePath);
  if (Result.isFailure(titleText)) return Result.failVoid;
  const agentConversation: AgentConversation = {
    agentSessionId: agentHistoryDependencies.path.basename(
      conversationFilePath,
      CLAUDE_HISTORY.CONVERSATION_FILE_EXTENSION
    ),
    title: yield* toOneLineTitle(titleText.success),
    updatedAtMillis: Result.getOrElse(
      Result.map(
        Result.fromOption(fileInfo.mtime, () => undefined),
        (modifiedAt) => modifiedAt.getTime()
      ),
      () => 0
    )
  };

  return Result.succeed(agentConversation);
});

// Its subagents' transcripts sit in a folder per conversation, so only the files at the top are conversations.
export const listClaudeConversations = Effect.fn("AgentHistoryInfraService.listClaudeConversations")(function* (
  agentHistoryDependencies: AgentHistoryDependencies,
  folderPath: string
) {
  const configFolderPath = yield* readFolderFromEnvironment(
    agentHistoryDependencies,
    CLAUDE_HISTORY.CONFIG_FOLDER_ENV,
    CLAUDE_HISTORY.DEFAULT_CONFIG_FOLDER
  );
  const historyFolderPath = agentHistoryDependencies.path.join(
    configFolderPath,
    CLAUDE_HISTORY.PROJECTS_FOLDER,
    String.replaceAll(CLAUDE_HISTORY.FOLDER_NAME_SYMBOL, CLAUDE_HISTORY.FOLDER_NAME_SYMBOL_REPLACEMENT)(folderPath)
  );
  yield* Effect.annotateCurrentSpan({historyFolderPath});
  const isHistoryFound = yield* agentHistoryDependencies.fileSystem.exists(historyFolderPath);
  if (!isHistoryFound) return [];
  const fileNames = yield* agentHistoryDependencies.fileSystem.readDirectory(historyFolderPath);
  const conversationResults = yield* Effect.forEach(
    Array.filter(fileNames, (fileName) => String.endsWith(CLAUDE_HISTORY.CONVERSATION_FILE_EXTENSION)(fileName)),
    (fileName) =>
      readClaudeConversation(agentHistoryDependencies, agentHistoryDependencies.path.join(historyFolderPath, fileName)),
    {concurrency: CLAUDE_HISTORY.READ_CONCURRENCY}
  );

  return Array.getSuccesses(conversationResults);
});

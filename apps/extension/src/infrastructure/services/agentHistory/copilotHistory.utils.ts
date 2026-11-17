import {
  decodeJsonLines,
  readFileSlice,
  readFolderFromEnvironment,
  toOneLineTitle
} from "@infraServices/agentHistory/agentHistory.utils.ts";
import {COPILOT_HISTORY} from "@pkg/constants/src/agentHistory.constant.ts";
import {Array, Effect, Record, Result, Schema, String} from "effect";

import type {AgentHistoryDependencies} from "@infraServices/agentHistory/agentHistory.infraService.type.ts";
import type {AgentConversation} from "@interfaces/agentHistory.infraService.interface.ts";

const CopilotEventLineJson = Schema.fromJsonString(
  Schema.Struct({
    data: Schema.optional(Schema.Struct({content: Schema.optional(Schema.String)})),
    type: Schema.String
  })
);

const readWorkspaceFields = Effect.fn("AgentHistoryInfraService.readWorkspaceFields")(function* (
  workspaceText: string
) {
  const workspaceFields: Record.ReadonlyRecord<string, string> = Record.fromEntries(
    Array.flatMap(String.split("\n")(workspaceText), (workspaceLine): readonly (readonly [string, string])[] => {
      const lineMatch = COPILOT_HISTORY.WORKSPACE_LINE.exec(workspaceLine);
      if (lineMatch === null || lineMatch.groups === undefined || lineMatch.groups.key === undefined) return [];
      const fieldValue = lineMatch.groups.value === undefined ? "" : lineMatch.groups.value;

      return [[lineMatch.groups.key, String.replaceAll(COPILOT_HISTORY.WORKSPACE_QUOTES, "")(String.trim(fieldValue))]];
    })
  );

  return workspaceFields;
});

const findFirstUserMessage = Effect.fn("AgentHistoryInfraService.findFirstUserMessage")(function* (
  agentHistoryDependencies: AgentHistoryDependencies,
  conversationFolderPath: string
) {
  const eventsFilePath = agentHistoryDependencies.path.join(conversationFolderPath, COPILOT_HISTORY.EVENTS_FILE_NAME);
  const isEventsFileFound = yield* agentHistoryDependencies.fileSystem.exists(eventsFilePath);
  if (!isEventsFileFound) return "";
  const eventsText = yield* readFileSlice(agentHistoryDependencies, {
    byteCount: COPILOT_HISTORY.HEAD_BYTES,
    filePath: eventsFilePath,
    position: 0n
  });
  const eventLines = yield* decodeJsonLines(CopilotEventLineJson, eventsText);
  const userMessages = Array.flatMap(eventLines, (eventLine) =>
    eventLine.type === COPILOT_HISTORY.USER_MESSAGE_EVENT &&
    eventLine.data !== undefined &&
    eventLine.data.content !== undefined
      ? [eventLine.data.content]
      : []
  );
  const [firstUserMessage = ""] = userMessages;

  return firstUserMessage;
});

// A folder without workspace.yaml is only a lock left behind; one with no name and no message never got a prompt.
const readCopilotConversation = Effect.fn("AgentHistoryInfraService.readCopilotConversation")(function* (
  agentHistoryDependencies: AgentHistoryDependencies,
  conversationFolderPath: string,
  folderPath: string
) {
  const workspaceFilePath = agentHistoryDependencies.path.join(
    conversationFolderPath,
    COPILOT_HISTORY.WORKSPACE_FILE_NAME
  );
  const isWorkspaceFound = yield* agentHistoryDependencies.fileSystem.exists(workspaceFilePath);
  if (!isWorkspaceFound) return Result.failVoid;
  const workspaceText = yield* agentHistoryDependencies.fileSystem.readFileString(workspaceFilePath);
  const workspaceFields = yield* readWorkspaceFields(workspaceText);
  if (workspaceFields.cwd !== folderPath) return Result.failVoid;
  const workspaceName = workspaceFields.name === undefined ? "" : workspaceFields.name;
  const titleText =
    workspaceName === ""
      ? yield* findFirstUserMessage(agentHistoryDependencies, conversationFolderPath)
      : workspaceName;
  if (titleText === "") return Result.failVoid;
  const agentConversation: AgentConversation = {
    agentSessionId:
      workspaceFields.id === undefined
        ? agentHistoryDependencies.path.basename(conversationFolderPath)
        : workspaceFields.id,
    title: yield* toOneLineTitle(titleText),
    updatedAtMillis: workspaceFields.updated_at === undefined ? 0 : Date.parse(workspaceFields.updated_at)
  };

  return Result.succeed(agentConversation);
});

// No index records the folder, so every conversation's workspace.yaml is read.
export const listCopilotConversations = Effect.fn("AgentHistoryInfraService.listCopilotConversations")(function* (
  agentHistoryDependencies: AgentHistoryDependencies,
  folderPath: string
) {
  const copilotHomePath = yield* readFolderFromEnvironment(
    agentHistoryDependencies,
    COPILOT_HISTORY.HOME_ENV,
    COPILOT_HISTORY.DEFAULT_HOME_FOLDER
  );
  const sessionsFolderPath = agentHistoryDependencies.path.join(copilotHomePath, COPILOT_HISTORY.SESSIONS_FOLDER);
  yield* Effect.annotateCurrentSpan({sessionsFolderPath});
  const isHistoryFound = yield* agentHistoryDependencies.fileSystem.exists(sessionsFolderPath);
  if (!isHistoryFound) return [];
  const conversationFolderNames = yield* agentHistoryDependencies.fileSystem.readDirectory(sessionsFolderPath);
  const conversationResults = yield* Effect.forEach(
    conversationFolderNames,
    (conversationFolderName) =>
      readCopilotConversation(
        agentHistoryDependencies,
        agentHistoryDependencies.path.join(sessionsFolderPath, conversationFolderName),
        folderPath
      ),
    {concurrency: COPILOT_HISTORY.READ_CONCURRENCY}
  );

  return Array.getSuccesses(conversationResults);
});

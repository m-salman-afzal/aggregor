import {NodeServices} from "@effect/platform-node";
import {AgentHistoryUtils} from "@infraServices/agentHistory/agentHistory.utils.ts";
import {COPILOT_HISTORY} from "@pkg/constants/src/agentHistory.constant.ts";
import {Array, Context, Effect, Layer, Record, Result, Schema, String} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

import type {AgentConversation} from "@interfaces/agentHistory.infraService.interface.ts";

const CopilotEventLineJson = Schema.fromJsonString(
  Schema.Struct({
    data: Schema.optional(Schema.Struct({content: Schema.optional(Schema.String)})),
    type: Schema.String
  })
);

export class CopilotHistoryUtils extends Context.Service<CopilotHistoryUtils>()(
  "aggregor-app/infrastructure/services/agentHistory/copilotHistory.utils/CopilotHistoryUtils",
  {
    make: Effect.fn("CopilotHistoryUtils.make")(function* () {
      const agentHistoryUtils = yield* AgentHistoryUtils;
      const fileSystem = yield* FileSystem;
      const path = yield* Path;

      const readWorkspaceFields = Effect.fn("CopilotHistoryUtils.readWorkspaceFields")(function* (
        workspaceText: string
      ) {
        const workspaceFields: Record.ReadonlyRecord<string, string> = Record.fromEntries(
          Array.flatMap(String.split("\n")(workspaceText), (workspaceLine): readonly (readonly [string, string])[] => {
            const lineMatch = COPILOT_HISTORY.WORKSPACE_LINE.exec(workspaceLine);
            if (lineMatch === null || lineMatch.groups === undefined || lineMatch.groups.key === undefined) return [];
            const fieldValue = lineMatch.groups.value === undefined ? "" : lineMatch.groups.value;

            return [
              [lineMatch.groups.key, String.replaceAll(COPILOT_HISTORY.WORKSPACE_QUOTES, "")(String.trim(fieldValue))]
            ];
          })
        );

        return workspaceFields;
      });

      const findFirstUserMessage = Effect.fn("CopilotHistoryUtils.findFirstUserMessage")(function* (
        conversationFolderPath: string
      ) {
        const eventsFilePath = path.join(conversationFolderPath, COPILOT_HISTORY.EVENTS_FILE_NAME);
        const isEventsFileFound = yield* fileSystem.exists(eventsFilePath);
        if (!isEventsFileFound) return "";
        const eventsText = yield* agentHistoryUtils.readFileSlice({
          byteCount: COPILOT_HISTORY.HEAD_BYTES,
          filePath: eventsFilePath,
          position: 0n
        });
        const eventLines = yield* agentHistoryUtils.decodeJsonLines(CopilotEventLineJson, eventsText);
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

      // A folder without workspace.yaml is only a lock left behind.
      const readCopilotConversation = Effect.fn("CopilotHistoryUtils.readCopilotConversation")(function* (
        conversationFolderPath: string,
        folderPath: string
      ) {
        const workspaceFilePath = path.join(conversationFolderPath, COPILOT_HISTORY.WORKSPACE_FILE_NAME);
        const isWorkspaceFound = yield* fileSystem.exists(workspaceFilePath);
        if (!isWorkspaceFound) return Result.failVoid;
        const workspaceText = yield* fileSystem.readFileString(workspaceFilePath);
        const workspaceFields = yield* readWorkspaceFields(workspaceText);
        if (workspaceFields.cwd !== folderPath) return Result.failVoid;
        const workspaceName = workspaceFields.name === undefined ? "" : workspaceFields.name;
        const titleText = workspaceName === "" ? yield* findFirstUserMessage(conversationFolderPath) : workspaceName;
        if (titleText === "") return Result.failVoid;
        const agentConversation: AgentConversation = {
          agentSessionId: workspaceFields.id === undefined ? path.basename(conversationFolderPath) : workspaceFields.id,
          title: yield* agentHistoryUtils.formatTextAsOneLineTitle(titleText),
          updatedAtMillis: workspaceFields.updated_at === undefined ? 0 : Date.parse(workspaceFields.updated_at)
        };

        return Result.succeed(agentConversation);
      });

      // No index records the folder, so every conversation's workspace.yaml is read.
      const listCopilotConversations = Effect.fn("CopilotHistoryUtils.listCopilotConversations")(function* (
        folderPath: string
      ) {
        const copilotHomePath = yield* agentHistoryUtils.readFolderFromEnvironment(
          COPILOT_HISTORY.HOME_ENV,
          COPILOT_HISTORY.DEFAULT_HOME_FOLDER
        );
        const sessionsFolderPath = path.join(copilotHomePath, COPILOT_HISTORY.SESSIONS_FOLDER);
        yield* Effect.annotateCurrentSpan({sessionsFolderPath});
        const isHistoryFound = yield* fileSystem.exists(sessionsFolderPath);
        if (!isHistoryFound) return [];
        const conversationFolderNames = yield* fileSystem.readDirectory(sessionsFolderPath);
        const conversationResults = yield* Effect.forEach(
          conversationFolderNames,
          (conversationFolderName) =>
            readCopilotConversation(path.join(sessionsFolderPath, conversationFolderName), folderPath),
          {concurrency: COPILOT_HISTORY.READ_CONCURRENCY}
        );

        return Array.getSuccesses(conversationResults);
      });

      return {listCopilotConversations};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([AgentHistoryUtils.layer, NodeServices.layer])
  );
}

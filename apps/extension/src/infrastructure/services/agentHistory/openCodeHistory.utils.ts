import {SqliteClient} from "@effect/sql-sqlite-node";
import {readFolderFromEnvironment, toOneLineTitle} from "@infraServices/agentHistory/agentHistory.utils.ts";
import {OPENCODE_HISTORY} from "@pkg/constants/src/agentHistory.constant.ts";
import {Array, Config, Effect, String} from "effect";
import {make as makeReactivity, Reactivity} from "effect/reactivity/Reactivity";

import type {AgentHistoryDependencies} from "@infraServices/agentHistory/agentHistory.infraService.type.ts";
import type {AgentConversation} from "@interfaces/agentHistory.infraService.interface.ts";

interface OpenCodeSessionRow {
  readonly firstPrompt: null | string;
  readonly id: string;
  readonly title: null | string;
  readonly updatedAt: number;
}

// OPENCODE_DB names the database in place of opencode.db, as a path or a file name in OpenCode's data folder.
const findOpenCodeDatabasePath = Effect.fn("AgentHistoryInfraService.findOpenCodeDatabasePath")(function* (
  agentHistoryDependencies: AgentHistoryDependencies
) {
  const dataHomePath = yield* readFolderFromEnvironment(
    agentHistoryDependencies,
    OPENCODE_HISTORY.DATA_HOME_ENV,
    OPENCODE_HISTORY.DEFAULT_DATA_HOME
  );
  const configuredDatabase = yield* Effect.orDie(Config.withDefault(Config.String(OPENCODE_HISTORY.DATABASE_ENV), ""));
  if (agentHistoryDependencies.path.isAbsolute(configuredDatabase)) return configuredDatabase;

  return agentHistoryDependencies.path.join(
    dataHomePath,
    OPENCODE_HISTORY.FOLDER_NAME,
    configuredDatabase === "" ? OPENCODE_HISTORY.DATABASE_FILE_NAME : configuredDatabase
  );
});

const toOpenCodeConversation = Effect.fn("AgentHistoryInfraService.toOpenCodeConversation")(function* (
  openCodeSessionRow: {readonly firstPrompt: string} & OpenCodeSessionRow
) {
  const agentConversation: AgentConversation = {
    agentSessionId: String.startsWith(OPENCODE_HISTORY.SESSION_ID_PREFIX)(openCodeSessionRow.id)
      ? String.slice(OPENCODE_HISTORY.SESSION_ID_PREFIX.length)(openCodeSessionRow.id)
      : openCodeSessionRow.id,
    title: yield* toOneLineTitle(
      openCodeSessionRow.title === null || openCodeSessionRow.title === ""
        ? openCodeSessionRow.firstPrompt
        : openCodeSessionRow.title
    ),
    updatedAtMillis: openCodeSessionRow.updatedAt
  };

  return agentConversation;
});

// A child session is a subagent's; one with no user message never got going.
export const listOpenCodeConversations = Effect.fn("AgentHistoryInfraService.listOpenCodeConversations")(
  function* (agentHistoryDependencies: AgentHistoryDependencies, folderPath: string) {
    const databaseFilePath = yield* findOpenCodeDatabasePath(agentHistoryDependencies);
    yield* Effect.annotateCurrentSpan({databaseFilePath});
    const isDatabaseFound = yield* agentHistoryDependencies.fileSystem.exists(databaseFilePath);
    if (!isDatabaseFound) return [];
    const openCodeSql = yield* SqliteClient.make({filename: databaseFilePath, readonly: true});
    const openCodeSessionRows = yield* openCodeSql<OpenCodeSessionRow>`
      SELECT session.id, session.title, session.time_updated AS updatedAt,
        (SELECT json_extract(message.data, '$.text') FROM session_message AS message
          WHERE message.session_id = session.id AND message.type = 'user' ORDER BY message.seq LIMIT 1) AS firstPrompt
      FROM session_v2 AS session
      WHERE session.directory = ${folderPath} AND session.parent_id IS NULL AND session.time_archived IS NULL`;

    return yield* Effect.forEach(
      Array.filter(
        openCodeSessionRows,
        (openCodeSessionRow): openCodeSessionRow is {readonly firstPrompt: string} & OpenCodeSessionRow =>
          openCodeSessionRow.firstPrompt !== null
      ),
      toOpenCodeConversation
    );
  },
  Effect.scoped,
  Effect.provideServiceEffect(Reactivity, makeReactivity)
);

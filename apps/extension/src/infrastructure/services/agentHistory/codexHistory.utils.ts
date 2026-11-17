import {SqliteClient} from "@effect/sql-sqlite-node";
import {readFolderFromEnvironment, toOneLineTitle} from "@infraServices/agentHistory/agentHistory.utils.ts";
import {CODEX_HISTORY} from "@pkg/constants/src/agentHistory.constant.ts";
import {Config, Effect} from "effect";
import {make as makeReactivity, Reactivity} from "effect/reactivity/Reactivity";

import type {AgentHistoryDependencies} from "@infraServices/agentHistory/agentHistory.infraService.type.ts";
import type {AgentConversation} from "@interfaces/agentHistory.infraService.interface.ts";

interface CodexThreadRow {
  readonly firstUserMessage: string;
  readonly id: string;
  readonly name: null | string;
  readonly updatedAt: number;
}

const findCodexDatabasePath = Effect.fn("AgentHistoryInfraService.findCodexDatabasePath")(function* (
  agentHistoryDependencies: AgentHistoryDependencies
) {
  const codexHomePath = yield* readFolderFromEnvironment(
    agentHistoryDependencies,
    CODEX_HISTORY.HOME_ENV,
    CODEX_HISTORY.DEFAULT_HOME_FOLDER
  );
  const sqliteHomePath = yield* Effect.orDie(Config.withDefault(Config.String(CODEX_HISTORY.SQLITE_HOME_ENV), ""));

  return agentHistoryDependencies.path.join(
    sqliteHomePath === "" ? codexHomePath : sqliteHomePath,
    CODEX_HISTORY.DATABASE_FILE_NAME
  );
});

const toCodexConversation = Effect.fn("AgentHistoryInfraService.toCodexConversation")(function* (
  codexThreadRow: CodexThreadRow
) {
  const agentConversation: AgentConversation = {
    agentSessionId: codexThreadRow.id,
    title: yield* toOneLineTitle(
      codexThreadRow.name === null || codexThreadRow.name === "" ? codexThreadRow.firstUserMessage : codexThreadRow.name
    ),
    updatedAtMillis: codexThreadRow.updatedAt * 1000
  };

  return agentConversation;
});

// Codex's own list leaves out empty threads, subagents', and those started by exec or an MCP client.
export const listCodexConversations = Effect.fn("AgentHistoryInfraService.listCodexConversations")(
  function* (agentHistoryDependencies: AgentHistoryDependencies, folderPath: string) {
    const databaseFilePath = yield* findCodexDatabasePath(agentHistoryDependencies);
    yield* Effect.annotateCurrentSpan({databaseFilePath});
    const isDatabaseFound = yield* agentHistoryDependencies.fileSystem.exists(databaseFilePath);
    if (!isDatabaseFound) return [];
    const codexSql = yield* SqliteClient.make({filename: databaseFilePath, readonly: true});
    const codexThreadRows = yield* codexSql<CodexThreadRow>`
      SELECT id, name, first_user_message AS firstUserMessage, updated_at AS updatedAt
      FROM threads
      WHERE cwd = ${folderPath} AND archived = 0 AND first_user_message <> ''
        AND source IN ('cli', 'vscode')
        AND id NOT IN (SELECT child_thread_id FROM thread_spawn_edges)`;

    return yield* Effect.forEach(codexThreadRows, toCodexConversation);
  },
  Effect.scoped,
  Effect.provideServiceEffect(Reactivity, makeReactivity)
);

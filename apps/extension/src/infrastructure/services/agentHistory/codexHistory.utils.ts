import {NodeServices} from "@effect/platform-node";
import {SqliteClient} from "@effect/sql-sqlite-node";
import {AgentHistoryUtils} from "@infraServices/agentHistory/agentHistory.utils.ts";
import {CODEX_HISTORY} from "@pkg/constants/src/agentHistory.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Config, Context, Effect, Layer} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";
import {make as makeReactivity, Reactivity} from "effect/reactivity/Reactivity";

import type {AgentConversation} from "@interfaces/agentHistory.infraService.interface.ts";

interface CodexThreadRow {
  readonly firstUserMessage: string;
  readonly id: string;
  readonly name: null | string;
  readonly updatedAt: number;
}

export class CodexHistoryUtils extends Context.Service<CodexHistoryUtils>()(
  "aggregor-app/infrastructure/services/agentHistory/codexHistory.utils/CodexHistoryUtils",
  {
    make: Effect.fn("make")(function* () {
      const agentHistoryUtils = yield* AgentHistoryUtils;
      const fileSystem = yield* FileSystem;
      const path = yield* Path;

      const findCodexDatabasePath = Effect.fn("findCodexDatabasePath")(function* () {
        const codexHomePath = yield* agentHistoryUtils.readFolderFromEnvironment(
          CODEX_HISTORY.HOME_ENV,
          CODEX_HISTORY.DEFAULT_HOME_FOLDER
        );
        const sqliteHomePath = yield* Effect.orDie(
          Config.withDefault(Config.String(CODEX_HISTORY.SQLITE_HOME_ENV), "")
        );

        return path.join(sqliteHomePath === "" ? codexHomePath : sqliteHomePath, CODEX_HISTORY.DATABASE_FILE_NAME);
      });

      const toCodexConversation = Effect.fn("toCodexConversation")(function* (codexThreadRow: CodexThreadRow) {
        const agentConversation: AgentConversation = {
          agentSessionId: codexThreadRow.id,
          title: yield* agentHistoryUtils.toOneLineTitle(
            codexThreadRow.name === null || codexThreadRow.name === ""
              ? codexThreadRow.firstUserMessage
              : codexThreadRow.name
          ),
          updatedAtMillis: codexThreadRow.updatedAt * 1000
        };

        return agentConversation;
      });

      // Codex's own list leaves out empty threads, subagents', and those started by exec or an MCP client.
      const listCodexConversations = Effect.fn("listCodexConversations")(
        function* (folderPath: string) {
          const databaseFilePath = yield* findCodexDatabasePath();
          yield* Effect.annotateCurrentSpan({databaseFilePath});
          const isDatabaseFound = yield* fileSystem.exists(databaseFilePath);
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

      return {listCodexConversations};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("CodexHistoryUtils", this.make())).pipe(
    Layer.provide([AgentHistoryUtils.layer, NodeServices.layer])
  );
}

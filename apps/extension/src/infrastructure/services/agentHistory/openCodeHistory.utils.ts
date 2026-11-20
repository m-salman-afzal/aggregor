import {NodeServices} from "@effect/platform-node";
import {SqliteClient} from "@effect/sql-sqlite-node";
import {AgentHistoryUtils} from "@infraServices/agentHistory/agentHistory.utils.ts";
import {OPENCODE_HISTORY} from "@pkg/constants/src/agentHistory.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Array, Config, Context, Effect, Layer, String} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";
import {make as makeReactivity, Reactivity} from "effect/reactivity/Reactivity";

import type {AgentConversation} from "@interfaces/agentHistory.infraService.interface.ts";

interface OpenCodeSessionRow {
  readonly firstPrompt: null | string;
  readonly id: string;
  readonly title: null | string;
  readonly updatedAt: number;
}

export class OpenCodeHistoryUtils extends Context.Service<OpenCodeHistoryUtils>()(
  "aggregor-app/infrastructure/services/agentHistory/openCodeHistory.utils/OpenCodeHistoryUtils",
  {
    make: Effect.fn("make")(function* () {
      const agentHistoryUtils = yield* AgentHistoryUtils;
      const fileSystem = yield* FileSystem;
      const path = yield* Path;

      // OPENCODE_DB names the database in place of opencode.db, as a path or a file name in OpenCode's data folder.
      const findOpenCodeDatabasePath = Effect.fn("findOpenCodeDatabasePath")(function* () {
        const dataHomePath = yield* agentHistoryUtils.readFolderFromEnvironment(
          OPENCODE_HISTORY.DATA_HOME_ENV,
          OPENCODE_HISTORY.DEFAULT_DATA_HOME
        );
        const configuredDatabase = yield* Effect.orDie(
          Config.withDefault(Config.String(OPENCODE_HISTORY.DATABASE_ENV), "")
        );
        if (path.isAbsolute(configuredDatabase)) return configuredDatabase;

        return path.join(
          dataHomePath,
          OPENCODE_HISTORY.FOLDER_NAME,
          configuredDatabase === "" ? OPENCODE_HISTORY.DATABASE_FILE_NAME : configuredDatabase
        );
      });

      const toOpenCodeConversation = Effect.fn("toOpenCodeConversation")(function* (
        openCodeSessionRow: {readonly firstPrompt: string} & OpenCodeSessionRow
      ) {
        const agentConversation: AgentConversation = {
          agentSessionId: String.startsWith(OPENCODE_HISTORY.SESSION_ID_PREFIX)(openCodeSessionRow.id)
            ? String.slice(OPENCODE_HISTORY.SESSION_ID_PREFIX.length)(openCodeSessionRow.id)
            : openCodeSessionRow.id,
          title: yield* agentHistoryUtils.toOneLineTitle(
            openCodeSessionRow.title === null || openCodeSessionRow.title === ""
              ? openCodeSessionRow.firstPrompt
              : openCodeSessionRow.title
          ),
          updatedAtMillis: openCodeSessionRow.updatedAt
        };

        return agentConversation;
      });

      // A child session is a subagent's; one with no user message never got going.
      const listOpenCodeConversations = Effect.fn("listOpenCodeConversations")(
        function* (folderPath: string) {
          const databaseFilePath = yield* findOpenCodeDatabasePath();
          yield* Effect.annotateCurrentSpan({databaseFilePath});
          const isDatabaseFound = yield* fileSystem.exists(databaseFilePath);
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

      return {listOpenCodeConversations};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("OpenCodeHistoryUtils", this.make())).pipe(
    Layer.provide([AgentHistoryUtils.layer, NodeServices.layer])
  );
}

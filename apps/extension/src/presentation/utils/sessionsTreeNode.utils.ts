import {SESSIONS_VIEW_NODE_ID_PREFIXES} from "@pkg/constants/src/sessionsView.constant.ts";
import {decodeVsCodeArgument, InvalidVsCodeArgumentError} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {Effect, Schema, String} from "effect";

export const makeProjectNodeId = Effect.fn("makeProjectNodeId")(function* (projectPath: string) {
  return `${SESSIONS_VIEW_NODE_ID_PREFIXES.PROJECT}${projectPath}`;
});

export const makeSessionNodeId = Effect.fn("makeSessionNodeId")(function* (sessionId: string) {
  return `${SESSIONS_VIEW_NODE_ID_PREFIXES.SESSION}${sessionId}`;
});

// The project's path or the session's id that the node shows.
export const readSessionsTreeNodeId = Effect.fn("readSessionsTreeNodeId")(function* (nodeId: string) {
  if (String.startsWith(SESSIONS_VIEW_NODE_ID_PREFIXES.PROJECT)(nodeId))
    return {
      _tag: "ProjectNode",
      projectPath: String.slice(SESSIONS_VIEW_NODE_ID_PREFIXES.PROJECT.length)(nodeId)
    } as const;
  if (String.startsWith(SESSIONS_VIEW_NODE_ID_PREFIXES.SESSION)(nodeId))
    return {
      _tag: "SessionNode",
      sessionId: String.slice(SESSIONS_VIEW_NODE_ID_PREFIXES.SESSION.length)(nodeId)
    } as const;

  return yield* InvalidVsCodeArgumentError.make({cause: nodeId});
});

// A project row's menu passes the node's id; the request names its project.
export const decodeProjectNodeRequest = Effect.fn("decodeProjectNodeRequest")(function* <
  RequestSchema extends Schema.Constraint
>(requestSchema: RequestSchema, projectNodeIdArgument: unknown) {
  const projectNodeId = yield* decodeVsCodeArgument(Schema.String, projectNodeIdArgument);
  const projectNode = yield* readSessionsTreeNodeId(projectNodeId);
  if (projectNode._tag !== "ProjectNode") return yield* InvalidVsCodeArgumentError.make({cause: projectNodeId});

  return yield* decodeVsCodeArgument(requestSchema, {projectPath: projectNode.projectPath});
});

// A session row's menu and its click pass the node's id; the request names its session.
export const decodeSessionNodeRequest = Effect.fn("decodeSessionNodeRequest")(function* <
  RequestSchema extends Schema.Constraint
>(requestSchema: RequestSchema, sessionNodeIdArgument: unknown) {
  const sessionNodeId = yield* decodeVsCodeArgument(Schema.String, sessionNodeIdArgument);
  const sessionNode = yield* readSessionsTreeNodeId(sessionNodeId);
  if (sessionNode._tag !== "SessionNode") return yield* InvalidVsCodeArgumentError.make({cause: sessionNodeId});

  return yield* decodeVsCodeArgument(requestSchema, {sessionId: sessionNode.sessionId});
});

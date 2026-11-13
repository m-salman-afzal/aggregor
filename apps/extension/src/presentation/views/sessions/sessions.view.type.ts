import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {SessionListItemDto} from "@dtos/session.dto.ts";
import type {
  SESSIONS_VIEW_MESSAGE_TAGS,
  SESSIONS_WEBVIEW_MESSAGE_TAGS
} from "@pkg/constants/src/sessionsView.constant.ts";

// What the Sessions view and its webview send each other. apps/webview imports these for types only.

// A session as the webview draws it: the node id its commands take, and its agent's icon as a URI the webview may load.
// A session whose agent is gone from the settings has no icon.
export interface SessionRowData {
  readonly agentIconUri?: string;
  readonly nodeId: string;
  readonly sessionListItem: SessionListItemDto;
}

// A project with its sessions, in their order.
export interface ProjectRowData {
  readonly nodeId: string;
  readonly projectListItem: ProjectListItemDto;
  readonly sessionRows: readonly SessionRowData[];
}

// Every project with its sessions, one project's sessions, one session, or the session whose tab is in front.
export type SessionsViewMessage =
  | {
      readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.PROJECT_SESSIONS_DRAWN;
      readonly projectPath: string;
      readonly sessionRows: readonly SessionRowData[];
    }
  | {readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.PROJECTS_DRAWN; readonly projectRows: readonly ProjectRowData[]}
  | {readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.SESSION_DRAWN; readonly sessionRow: SessionRowData}
  | {readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.VIEWED_SESSION_CHANGED; readonly sessionId: string};

// Ready once its script listens, so the view draws everything; RunCommand runs one of the view's commands on a row.
export type SessionsWebviewMessage =
  | {readonly _tag: typeof SESSIONS_WEBVIEW_MESSAGE_TAGS.READY}
  | {
      readonly _tag: typeof SESSIONS_WEBVIEW_MESSAGE_TAGS.RUN_COMMAND;
      readonly commandId: string;
      readonly nodeId?: string;
    };

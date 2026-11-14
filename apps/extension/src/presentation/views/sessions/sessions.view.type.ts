import type {AgentListItemDto} from "@dtos/agent.dto.ts";
import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {SessionListItemDto, WorktreeListItemDto} from "@dtos/session.dto.ts";
import type {
  SESSIONS_VIEW_MESSAGE_TAGS,
  SESSIONS_WEBVIEW_MESSAGE_TAGS
} from "@pkg/constants/src/sessionsView.constant.ts";

// apps/webview imports these for types only.

export interface SessionRowData {
  readonly agentIconUri?: string;
  readonly sessionListItem: SessionListItemDto;
}

export interface ProjectRowData {
  readonly projectListItem: ProjectListItemDto;
  readonly sessionRows: readonly SessionRowData[];
  readonly worktrees?: readonly WorktreeListItemDto[];
}

export interface AgentRowData {
  readonly agentListItem: AgentListItemDto;
  readonly iconUri: string;
}

// A row's key, the field its command's request DTO starts from.
export type RowCommandArgument = Readonly<Record<string, string>>;

// The request DTO the command's controller decodes.
export type CommandRequest = Readonly<Record<string, unknown>>;

export type SessionsViewMessage =
  | {
      readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.AGENTS_DRAWN;
      readonly agentRows: readonly AgentRowData[];
      readonly skipAgentPicker: boolean;
    }
  | {
      readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.APPEARANCE_DRAWN;
      // neutral, theme, palette or a #rrggbb colour.
      readonly accentColor: string;
      readonly fontSize: number;
    }
  | {readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.ARCHIVE_DRAWN; readonly projectRows: readonly ProjectRowData[]}
  | {
      readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.PROJECT_SESSIONS_DRAWN;
      readonly projectPath: string;
      readonly sessionRows: readonly SessionRowData[];
    }
  | {readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.PROJECTS_DRAWN; readonly projectRows: readonly ProjectRowData[]}
  | {readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.SESSION_DRAWN; readonly sessionRow: SessionRowData}
  | {readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.VIEWED_SESSION_CHANGED; readonly sessionId: string}
  | {
      readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.WAITING_COUNTS_DRAWN;
      readonly archiveWaitingCount: number;
      readonly sessionsWaitingCount: number;
    };

export type SessionsWebviewMessage =
  | {readonly _tag: typeof SESSIONS_WEBVIEW_MESSAGE_TAGS.READY}
  | {
      readonly _tag: typeof SESSIONS_WEBVIEW_MESSAGE_TAGS.RUN_COMMAND;
      readonly commandArgument?: CommandRequest;
      readonly commandId: string;
    };

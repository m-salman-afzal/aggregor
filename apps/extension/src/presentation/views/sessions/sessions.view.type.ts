import type {AgentListItemDto} from "@dtos/agent.dto.ts";
import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {SessionPullRequestsDto} from "@dtos/pullRequest.dto.ts";
import type {SessionListItemDto, SessionPageDto, WorktreeListItemDto} from "@dtos/session.dto.ts";
import type {ImportableSessionsDto} from "@dtos/sessionImport.dto.ts";
import type {SessionProcessesDto} from "@dtos/sessionProcess.dto.ts";
import type {ProjectBranchesDto, ProjectLeftoversDto} from "@dtos/worktree.dto.ts";
import type {
  SESSION_LISTS,
  SESSIONS_VIEW_MESSAGE_TAGS,
  SESSIONS_WEBVIEW_MESSAGE_TAGS
} from "@pkg/constants/src/sessionsView.constant.ts";
import type {Ref, SubscriptionRef} from "effect";

// apps/webview imports these for types only.

export interface SessionRowData {
  readonly agentIconUri?: string;
  readonly sessionListItem: SessionListItemDto;
}

export interface ProjectRowData {
  readonly hasLeftovers?: boolean;
  readonly projectListItem: ProjectListItemDto;
  readonly sessionPage: SessionPageDto;
  readonly sessionRows: readonly SessionRowData[];
  readonly worktrees?: readonly WorktreeListItemDto[];
  readonly worktreesRootPath?: string;
}

export interface AgentRowData {
  readonly agentListItem: AgentListItemDto;
  readonly iconUri: string;
}

export type SessionListId = (typeof SESSION_LISTS)[keyof typeof SESSION_LISTS];

// The sessions whose dropdowns the webview shows open, whose processes it reads.
export type OpenDropdownSessionIds = SubscriptionRef.SubscriptionRef<readonly string[]>;

// How many pages of sessions each project shows in each list, by project path; a project not in it shows one.
export type ShownSessionPages = Ref.Ref<Readonly<Record<SessionListId, Readonly<Record<string, number>>>>>;

// A row's key, the field its command's request DTO starts from.
export type RowCommandArgument = Readonly<Record<string, string>>;

// The request DTO the command's controller decodes.
export type CommandRequest = Readonly<Record<string, unknown>>;

export type SessionsViewMessage =
  | {
      readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.AGENTS_DRAWN;
      readonly agentRows: readonly AgentRowData[];
      readonly isWorkspaceTrustEnabled: boolean;
      readonly skipAgentPicker: boolean;
    }
  | {
      readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.APPEARANCE_DRAWN;
      // neutral, theme, palette or a #rrggbb colour.
      readonly accentColor: string;
      readonly fontSize: number;
    }
  | {readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.ARCHIVE_DRAWN; readonly projectRows: readonly ProjectRowData[]}
  | {readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.BRANCHES_DRAWN; readonly branches: ProjectBranchesDto}
  | {
      readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.IMPORTABLE_SESSIONS_DRAWN;
      readonly importableSessions: ImportableSessionsDto;
    }
  | {readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.LEFTOVERS_DRAWN; readonly leftovers: ProjectLeftoversDto}
  | {readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.PROJECT_DRAWN; readonly projectRow: ProjectRowData}
  | {readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.PROJECTS_DRAWN; readonly projectRows: readonly ProjectRowData[]}
  | {
      readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.PULL_REQUESTS_DRAWN;
      readonly pullRequests: SessionPullRequestsDto;
    }
  | {readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.SESSION_DRAWN; readonly sessionRow: SessionRowData}
  | {
      readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.SESSION_PROCESSES_DRAWN;
      readonly sessionProcesses: SessionProcessesDto;
    }
  | {readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.VIEWED_SESSION_CHANGED; readonly sessionId: string}
  | {
      readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.WAITING_COUNTS_DRAWN;
      readonly archiveWaitingCount: number;
      readonly sessionsWaitingCount: number;
    };

export type SessionsWebviewMessage =
  | {readonly _tag: typeof SESSIONS_WEBVIEW_MESSAGE_TAGS.LIST_BRANCHES; readonly projectPath: string}
  | {readonly _tag: typeof SESSIONS_WEBVIEW_MESSAGE_TAGS.LIST_IMPORTABLE_SESSIONS; readonly projectPath: string}
  | {readonly _tag: typeof SESSIONS_WEBVIEW_MESSAGE_TAGS.LIST_LEFTOVERS; readonly projectPath: string}
  | {readonly _tag: typeof SESSIONS_WEBVIEW_MESSAGE_TAGS.LIST_PULL_REQUESTS; readonly sessionId: string}
  | {readonly _tag: typeof SESSIONS_WEBVIEW_MESSAGE_TAGS.READY}
  | {
      readonly _tag: typeof SESSIONS_WEBVIEW_MESSAGE_TAGS.RUN_COMMAND;
      readonly commandArgument?: CommandRequest;
      readonly commandId: string;
    }
  | {
      readonly _tag: typeof SESSIONS_WEBVIEW_MESSAGE_TAGS.SHOW_MORE_SESSIONS;
      readonly listId: SessionListId;
      readonly projectPath: string;
    }
  | {
      readonly _tag: typeof SESSIONS_WEBVIEW_MESSAGE_TAGS.WATCH_SESSION_PROCESSES;
      readonly sessionIds: readonly string[];
    };

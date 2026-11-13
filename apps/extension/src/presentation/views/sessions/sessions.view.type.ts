import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {SessionListItemDto} from "@dtos/session.dto.ts";
import type {
  PROMPT_TAGS,
  SESSIONS_VIEW_MESSAGE_TAGS,
  SESSIONS_WEBVIEW_MESSAGE_TAGS
} from "@pkg/constants/src/sessionsView.constant.ts";
import type {ViewPrompt, ViewPromptAnswer, ViewPromptChoice} from "@pkg/vscode/src/viewPrompt.type.ts";

// apps/webview imports these for types only.

export interface SessionRowData {
  readonly agentIconUri?: string;
  readonly nodeId: string;
  readonly sessionListItem: SessionListItemDto;
}

export interface ProjectRowData {
  readonly nodeId: string;
  readonly projectListItem: ProjectListItemDto;
  readonly sessionRows: readonly SessionRowData[];
}

export type WebviewPromptChoice = {readonly iconUri?: string} & Omit<ViewPromptChoice, "iconPath">;

export type WebviewPrompt =
  | {
      readonly _tag: typeof PROMPT_TAGS.CHOICE;
      readonly choices: readonly WebviewPromptChoice[];
      readonly title: string;
    }
  | Exclude<ViewPrompt, {readonly _tag: typeof PROMPT_TAGS.CHOICE}>;

export type SessionsViewMessage =
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
  | {readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.PROMPT_SHOWN; readonly prompt: WebviewPrompt}
  | {readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.SESSION_DRAWN; readonly sessionRow: SessionRowData}
  | {readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.VIEWED_SESSION_CHANGED; readonly sessionId: string}
  | {
      readonly _tag: typeof SESSIONS_VIEW_MESSAGE_TAGS.WAITING_COUNTS_DRAWN;
      readonly archiveWaitingCount: number;
      readonly sessionsWaitingCount: number;
    };

export type SessionsWebviewMessage =
  | {readonly _tag: typeof SESSIONS_WEBVIEW_MESSAGE_TAGS.PROMPT_ANSWERED; readonly answer: ViewPromptAnswer}
  | {readonly _tag: typeof SESSIONS_WEBVIEW_MESSAGE_TAGS.READY}
  | {
      readonly _tag: typeof SESSIONS_WEBVIEW_MESSAGE_TAGS.RUN_COMMAND;
      readonly commandId: string;
      readonly nodeId?: string;
    };

import type {SESSION_LISTS} from "@/modules/sessions/sessions.constant.ts";
import type {
  SESSIONS_WEBVIEW_COMMANDS,
  SESSIONS_WEBVIEW_MESSAGE_TAGS
} from "@pkg/constants/src/sessionsView.constant.ts";
import type {SessionsWebviewMessage} from "@views/sessions/sessions.view.type.ts";
import type {LucideIcon} from "lucide-react";

export type PromptAnswer = Extract<
  SessionsWebviewMessage,
  {readonly _tag: typeof SESSIONS_WEBVIEW_MESSAGE_TAGS.PROMPT_ANSWERED}
>["answer"];

export interface RowAction {
  readonly commandId: (typeof SESSIONS_WEBVIEW_COMMANDS)[number];
  readonly icon: LucideIcon;
  readonly isDestructive?: boolean;
  readonly label: string;
  readonly sharedRowLabel?: string;
}

export type SessionListId = (typeof SESSION_LISTS)[keyof typeof SESSION_LISTS];

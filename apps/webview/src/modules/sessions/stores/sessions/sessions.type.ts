import type {PromptAnswer, SessionListId} from "@/modules/sessions/sessions.type.ts";
import type {ProjectRowData, SessionsViewMessage, WebviewPrompt} from "@views/sessions/sessions.view.type.ts";

export type HostMessagesByTag = {[HostMessage in SessionsViewMessage as HostMessage["_tag"]]: HostMessage};

// The page reloads each time the view comes back into sight; VS Code keeps the folds and the session in front for it.
export interface SessionsData {
  readonly appearance: {readonly accentColor: string; readonly fontSize: number} | undefined;
  readonly archiveProjectRows: readonly ProjectRowData[];
  readonly collapsedListIds: ReadonlySet<SessionListId>;
  readonly collapsedProjectKeys: ReadonlySet<string>;
  readonly isDrawn: boolean;
  readonly projectRows: readonly ProjectRowData[];
  readonly prompt: undefined | WebviewPrompt;
  readonly viewedSessionId: string | undefined;
  readonly waitingCounts: Readonly<Record<SessionListId, number>>;
}

export interface SessionsState extends SessionsData {
  readonly answerPrompt: (promptAnswer: PromptAnswer) => void;
  readonly setListOpen: (listId: SessionListId, isOpen: boolean) => void;
  readonly setProjectOpen: (projectKey: string, isOpen: boolean) => void;
}

import {ACCENT_SOURCES, APPEARANCE_PROPERTIES, SESSION_LISTS} from "@/modules/sessions/sessions.constant.ts";
import {SESSIONS_WEBVIEW_MESSAGE_TAGS} from "@pkg/constants/src/sessionsView.constant.ts";

import type {PromptAnswer, SessionListId} from "@/modules/sessions/sessions.type.ts";
import type {SessionsViewMessage, SessionsWebviewMessage} from "@views/sessions/sessions.view.type.ts";

// A folded project is keyed by its list and its node id, since a project shows in both lists.
interface WebviewState {
  readonly collapsedListIds: readonly SessionListId[];
  readonly collapsedProjectKeys: readonly string[];
  readonly viewedSessionId?: string | undefined;
}

// VS Code hands the API out once per page.
const vsCodeWebviewApi = acquireVsCodeApi<WebviewState>();

const postToHost = (sessionsWebviewMessage: SessionsWebviewMessage) => {
  vsCodeWebviewApi.postMessage(sessionsWebviewMessage);
};

export const askHostToDraw = () => {
  postToHost({_tag: SESSIONS_WEBVIEW_MESSAGE_TAGS.READY});
};

export const answerPromptOnHost = (promptAnswer: PromptAnswer) => {
  postToHost({_tag: SESSIONS_WEBVIEW_MESSAGE_TAGS.PROMPT_ANSWERED, answer: promptAnswer});
};

export const applyAppearance = (fontSize: number, accentColor: string) => {
  const accentSource = ACCENT_SOURCES[accentColor] ?? {accent: accentColor, shade: "var(--brand)"};
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty(APPEARANCE_PROPERTIES.FONT_SIZE, `${fontSize}px`);
  rootStyle.setProperty(APPEARANCE_PROPERTIES.ACCENT, accentSource.accent);
  rootStyle.setProperty(APPEARANCE_PROPERTIES.SHADE, accentSource.shade);
};

export const runCommandOnHost = (commandId: string, nodeId?: string) => {
  postToHost(
    nodeId === undefined
      ? {_tag: SESSIONS_WEBVIEW_MESSAGE_TAGS.RUN_COMMAND, commandId}
      : {_tag: SESSIONS_WEBVIEW_MESSAGE_TAGS.RUN_COMMAND, commandId, nodeId}
  );
};

// Only the host posts to the page.
export const listenToHost = (onHostMessage: (sessionsViewMessage: SessionsViewMessage) => void) => {
  window.addEventListener("message", (messageEvent: MessageEvent<SessionsViewMessage>) => {
    onHostMessage(messageEvent.data);
  });
};

export const readWebviewState = (): WebviewState => {
  const savedState = vsCodeWebviewApi.getState();

  return {
    collapsedListIds: savedState?.collapsedListIds ?? [SESSION_LISTS.ARCHIVE],
    collapsedProjectKeys: savedState?.collapsedProjectKeys ?? [],
    viewedSessionId: savedState?.viewedSessionId
  };
};

export const saveWebviewState = (webviewState: WebviewState) => {
  vsCodeWebviewApi.setState(webviewState);
};

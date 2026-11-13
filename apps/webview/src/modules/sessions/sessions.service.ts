import {SESSIONS_WEBVIEW_MESSAGE_TAGS} from "@pkg/constants/src/sessionsView.constant.ts";

import type {SessionsViewMessage, SessionsWebviewMessage} from "@views/sessions/sessions.view.type.ts";

// The webview's host, the extension's Sessions view, reached through VS Code's webview API: the messages both ways, and
// the state VS Code keeps for the page while the view is hidden.

interface WebviewState {
  readonly collapsedProjectNodeIds: readonly string[];
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

// Nothing folded, and no session in front, on the page's first load in a window.
export const readWebviewState = (): WebviewState => vsCodeWebviewApi.getState() ?? {collapsedProjectNodeIds: []};

export const saveWebviewState = (webviewState: WebviewState) => {
  vsCodeWebviewApi.setState(webviewState);
};

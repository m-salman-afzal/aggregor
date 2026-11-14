import {APPEARANCE, SESSION_LISTS} from "@/modules/sessions/sessions.constant.ts";
import {SESSIONS_WEBVIEW_MESSAGE_TAGS} from "@pkg/constants/src/sessionsView.constant.ts";

import type {SessionListId} from "@/modules/sessions/sessions.type.ts";
import type {CommandRequest, SessionsViewMessage, SessionsWebviewMessage} from "@views/sessions/sessions.view.type.ts";

// A folded project is keyed by its list and its path, since a project shows in both lists.
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

export const askHostForLeftovers = (projectPath: string) => {
  postToHost({_tag: SESSIONS_WEBVIEW_MESSAGE_TAGS.LIST_LEFTOVERS, projectPath});
};

export const askHostToDraw = () => {
  postToHost({_tag: SESSIONS_WEBVIEW_MESSAGE_TAGS.READY});
};

// The page's content security policy lets an inline style in only with this nonce.
export const readStyleNonce = () =>
  document.querySelector<HTMLMetaElement>(APPEARANCE.STYLE_NONCE_META_SELECTOR)?.nonce;

export const runCommandOnHost = (commandId: string, commandArgument?: CommandRequest) => {
  postToHost(
    commandArgument === undefined
      ? {_tag: SESSIONS_WEBVIEW_MESSAGE_TAGS.RUN_COMMAND, commandId}
      : {_tag: SESSIONS_WEBVIEW_MESSAGE_TAGS.RUN_COMMAND, commandArgument, commandId}
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

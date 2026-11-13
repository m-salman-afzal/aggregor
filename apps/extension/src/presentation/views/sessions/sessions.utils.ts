import {SESSIONS_WEBVIEW, SESSIONS_WEBVIEW_HTML} from "@pkg/constants/src/sessionsView.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {Array, Config, Effect, String} from "effect";
import {SecureRandom} from "effect/crypto";

import type {SessionListItemDto} from "@dtos/session.dto.ts";
import type {Uri, Webview} from "vscode";

export const countViewSessionsWaitingOnUser = Effect.fn("SessionsView.countViewSessionsWaitingOnUser")(function* (
  sessionsWaitingOnUser: readonly SessionListItemDto[],
  isArchiveView: boolean
) {
  return Array.filter(
    sessionsWaitingOnUser,
    (sessionWaitingOnUser) => sessionWaitingOnUser.isArchived === isArchiveView
  ).length;
});

export const setUpWebviewOptions = Effect.fn("SessionsView.setUpWebviewOptions")(function* (webview: Webview) {
  const vsCodeApi = yield* VsCodeApi;

  yield* Effect.sync(() => {
    webview.options = {enableScripts: true, localResourceRoots: [vsCodeApi.extensionUri]};
  });
});

// An icon outside the extension needs its folder allowed; VS Code then reloads the page, which asks to be drawn again.
const allowIconFolder = Effect.fn("SessionsView.allowIconFolder")(function* (webview: Webview, iconFileUri: Uri) {
  const vsCodeApi = yield* VsCodeApi;
  const iconFolderUri = vsCodeApi.Uri.joinPath(iconFileUri, "..");
  const allowedFolderUris = webview.options.localResourceRoots === undefined ? [] : webview.options.localResourceRoots;
  const isAllowed = Array.some(allowedFolderUris, (allowedFolderUri) =>
    String.startsWith(`${allowedFolderUri.toString()}/`)(`${iconFolderUri.toString()}/`)
  );
  if (isAllowed) return;

  yield* Effect.sync(() => {
    webview.options = {...webview.options, localResourceRoots: [...allowedFolderUris, iconFolderUri]};
  });
});

export const makeIconWebviewUri = Effect.fn("SessionsView.makeIconWebviewUri")(function* (
  webview: Webview,
  iconPath: string
) {
  const vsCodeApi = yield* VsCodeApi;
  const iconFileUri = vsCodeApi.Uri.file(iconPath);
  yield* allowIconFolder(webview, iconFileUri);

  return webview.asWebviewUri(iconFileUri).toString();
});

export const getAgentIconUri = Effect.fn("SessionsView.getAgentIconUri")(function* (
  webview: Webview,
  sessionListItem: SessionListItemDto
) {
  if (sessionListItem.icon === undefined) return {};

  return {agentIconUri: yield* makeIconWebviewUri(webview, sessionListItem.icon)};
});

const makeBuiltPageHtml = Effect.fn("SessionsView.makeBuiltPageHtml")(function* (webview: Webview, nonce: string) {
  const vsCodeApi = yield* VsCodeApi;
  const buildFolderUri = vsCodeApi.Uri.joinPath(vsCodeApi.extensionUri, SESSIONS_WEBVIEW.BUILD_FOLDER);
  const styleUri = webview.asWebviewUri(vsCodeApi.Uri.joinPath(buildFolderUri, SESSIONS_WEBVIEW.STYLE_FILE_NAME));
  const scriptUri = webview.asWebviewUri(vsCodeApi.Uri.joinPath(buildFolderUri, SESSIONS_WEBVIEW.SCRIPT_FILE_NAME));

  return SESSIONS_WEBVIEW_HTML.BUILT({
    cspSource: webview.cspSource,
    nonce,
    scriptUri: scriptUri.toString(),
    styleUri: styleUri.toString()
  });
});

// From apps/webview's dev server while F5 sets its URL, so edits reload in place; else from the build.
export const makeWebviewHtml = Effect.fn("SessionsView.makeWebviewHtml")(function* (webview: Webview) {
  const developmentServerUrl = yield* Config.withDefault(
    Config.String(SESSIONS_WEBVIEW.DEVELOPMENT_SERVER_URL_VARIABLE),
    ""
  );
  const secureRandom = yield* SecureRandom.SecureRandom;
  const nonce = yield* secureRandom.uuidV4();
  if (developmentServerUrl === "") return yield* makeBuiltPageHtml(webview, nonce);

  const developmentServerSocketUrl = String.replace(SESSIONS_WEBVIEW.HTTP_SCHEME_PATTERN, "ws")(developmentServerUrl);

  return SESSIONS_WEBVIEW_HTML.DEVELOPMENT_SERVER({
    cspSource: webview.cspSource,
    developmentServerSocketUrl,
    developmentServerUrl,
    nonce
  });
});

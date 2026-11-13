import {SESSIONS_WEBVIEW, SESSIONS_WEBVIEW_HTML} from "@pkg/constants/src/sessionsView.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {Array, Config, Effect, String} from "effect";
import {SecureRandom} from "effect/crypto";

import type {SessionListItemDto} from "@dtos/session.dto.ts";
import type {Uri, Webview} from "vscode";

// How the Sessions view sets up its webview and counts the sessions waiting on the user.

// How many of a view's sessions wait on the user, for the count in its name.
export const countViewSessionsWaitingOnUser = Effect.fn("SessionsView.countViewSessionsWaitingOnUser")(function* (
  sessionsWaitingOnUser: readonly SessionListItemDto[],
  isArchiveView: boolean
) {
  return Array.filter(
    sessionsWaitingOnUser,
    (sessionWaitingOnUser) => sessionWaitingOnUser.isArchived === isArchiveView
  ).length;
});

// The webview runs scripts and loads files from the extension, its build and the built-in agents' icons among them.
export const setUpWebviewOptions = Effect.fn("SessionsView.setUpWebviewOptions")(function* (webview: Webview) {
  const vsCodeApi = yield* VsCodeApi;

  yield* Effect.sync(() => {
    webview.options = {enableScripts: true, localResourceRoots: [vsCodeApi.extensionUri]};
  });
});

// An agent icon outside the extension, set in the agents setting, needs its folder allowed too. VS Code reloads the
// page when the folders change, and the reloaded page asks to be drawn again, by then with the folder allowed.
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

// The agent's icon as the webview loads it; a session whose agent is gone has none.
export const getAgentIconUri = Effect.fn("SessionsView.getAgentIconUri")(function* (
  webview: Webview,
  sessionListItem: SessionListItemDto
) {
  if (sessionListItem.icon === undefined) return {};
  const vsCodeApi = yield* VsCodeApi;
  const iconFileUri = vsCodeApi.Uri.file(sessionListItem.icon);
  yield* allowIconFolder(webview, iconFileUri);

  return {agentIconUri: webview.asWebviewUri(iconFileUri).toString()};
});

// apps/webview's build, from the extension's dist/webview.
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

// The page: from apps/webview's dev server while F5 sets its URL, so edits reload in place, else from the build.
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

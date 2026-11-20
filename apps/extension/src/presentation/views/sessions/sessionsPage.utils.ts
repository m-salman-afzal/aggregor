import {SESSIONS_WEBVIEW, SESSIONS_WEBVIEW_HTML} from "@pkg/constants/src/sessionsView.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {Array, Config, Context, Effect, Layer, String} from "effect";
import {SecureRandom} from "effect/crypto";

import type {SessionListItemDto} from "@dtos/session.dto.ts";
import type {Uri, Webview} from "vscode";

export class SessionsPageUtils extends Context.Service<SessionsPageUtils>()(
  "aggregor-app/presentation/views/sessions/sessionsPage.utils/SessionsPageUtils",
  {
    make: Effect.fn("make")(function* () {
      const vsCodeApi = yield* VsCodeApi;
      const secureRandom = yield* SecureRandom.SecureRandom;

      const setUpWebviewOptions = Effect.fn("setUpWebviewOptions")(function* (webview: Webview) {
        yield* Effect.sync(() => {
          webview.options = {enableScripts: true, localResourceRoots: [vsCodeApi.extensionUri]};
        });
      });

      // Changing localResourceRoots makes VS Code reload the page, which asks to be drawn again.
      const allowIconFolder = Effect.fn("allowIconFolder")(function* (webview: Webview, iconFileUri: Uri) {
        const iconFolderUri = vsCodeApi.Uri.joinPath(iconFileUri, "..");
        const allowedFolderUris =
          webview.options.localResourceRoots === undefined ? [] : webview.options.localResourceRoots;
        const isAllowed = Array.some(allowedFolderUris, (allowedFolderUri) =>
          String.startsWith(`${allowedFolderUri.toString()}/`)(`${iconFolderUri.toString()}/`)
        );
        if (isAllowed) return;

        yield* Effect.sync(() => {
          webview.options = {...webview.options, localResourceRoots: [...allowedFolderUris, iconFolderUri]};
        });
      });

      const makeIconWebviewUri = Effect.fn("makeIconWebviewUri")(function* (webview: Webview, iconPath: string) {
        const iconFileUri = vsCodeApi.Uri.file(iconPath);
        yield* allowIconFolder(webview, iconFileUri);

        return webview.asWebviewUri(iconFileUri).toString();
      });

      const getAgentIconUri = Effect.fn("getAgentIconUri")(function* (
        webview: Webview,
        sessionListItem: SessionListItemDto
      ) {
        if (sessionListItem.icon === undefined) return {};

        return {agentIconUri: yield* makeIconWebviewUri(webview, sessionListItem.icon)};
      });

      const makeBuiltPageHtml = Effect.fn("makeBuiltPageHtml")(function* (webview: Webview, nonce: string) {
        const buildFolderUri = vsCodeApi.Uri.joinPath(vsCodeApi.extensionUri, SESSIONS_WEBVIEW.BUILD_FOLDER);
        const styleUri = webview.asWebviewUri(vsCodeApi.Uri.joinPath(buildFolderUri, SESSIONS_WEBVIEW.STYLE_FILE_NAME));
        const scriptUri = webview.asWebviewUri(
          vsCodeApi.Uri.joinPath(buildFolderUri, SESSIONS_WEBVIEW.SCRIPT_FILE_NAME)
        );

        return SESSIONS_WEBVIEW_HTML.BUILT({
          cspSource: webview.cspSource,
          nonce,
          scriptUri: scriptUri.toString(),
          styleUri: styleUri.toString()
        });
      });

      const makeWebviewHtml = Effect.fn("makeWebviewHtml")(function* (webview: Webview) {
        const developmentServerUrl = yield* Config.withDefault(
          Config.String(SESSIONS_WEBVIEW.DEVELOPMENT_SERVER_URL_VARIABLE),
          ""
        );
        const nonce = yield* secureRandom.uuidV4();
        if (developmentServerUrl === "") return yield* makeBuiltPageHtml(webview, nonce);

        const developmentServerSocketUrl = String.replace(
          SESSIONS_WEBVIEW.HTTP_SCHEME_PATTERN,
          "ws"
        )(developmentServerUrl);

        return SESSIONS_WEBVIEW_HTML.DEVELOPMENT_SERVER({
          cspSource: webview.cspSource,
          developmentServerSocketUrl,
          developmentServerUrl,
          nonce
        });
      });

      return {getAgentIconUri, makeIconWebviewUri, makeWebviewHtml, setUpWebviewOptions};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("SessionsPageUtils", this.make())).pipe(
    Layer.provide(SecureRandom.layerWebCrypto)
  );
}

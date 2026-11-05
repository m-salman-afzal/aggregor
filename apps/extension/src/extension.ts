import {AppLayer} from "@di/app.layer.ts";
import {TraceLogLayer} from "@logger/traceLog.layer.ts";
import {SessionsView} from "@views/sessions/sessions.view.ts";
import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import {Layer, ManagedRuntime} from "effect";

import {RoutesLayer} from "./presentation/routes.ts";

import type {ExtensionContext} from "vscode";

const activate = async (extensionContext: ExtensionContext) => {
  // TraceLogLayer goes under everything, so every layer's startup work is traced and logged too.
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(RoutesLayer, SessionsView).pipe(
      Layer.provideMerge(AppLayer),
      Layer.provide(TraceLogLayer),
      Layer.provideMerge(VsCodeApi.layer(extensionContext))
    )
  );
  extensionContext.subscriptions.push({dispose: async () => runtime.dispose()});
  // The runtime builds lazily; build it now so commands and views exist before activation finishes.
  await runtime.context();
};

export {activate};

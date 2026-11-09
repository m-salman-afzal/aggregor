import {AppLayer} from "@di/app.layer.ts";
import {TraceLogLayer} from "@logger/traceLog.layer.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {SessionAlertsView} from "@views/sessionAlerts/sessionAlerts.view.ts";
import {SessionsView} from "@views/sessions/sessions.view.ts";
import {Effect, Layer, ManagedRuntime} from "effect";

import {RoutesLayer} from "./presentation/routes.ts";

import type {ExtensionContext} from "vscode";

// eslint-disable-next-line no-restricted-syntax -- VS Code's entry point, which runs the runtime itself
const activate = (extensionContext: ExtensionContext) => {
  // TraceLogLayer goes under everything, so every layer's startup work is traced and logged too.
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(RoutesLayer, SessionsView, SessionAlertsView).pipe(
      Layer.provideMerge(AppLayer),
      Layer.provide(TraceLogLayer),
      Layer.provideMerge(VsCodeApi.layer(extensionContext))
    )
  );
  extensionContext.subscriptions.push({dispose: () => runtime.dispose()});

  // The runtime builds lazily; build it now so commands and views exist before activation finishes.
  return runtime.runPromise(Effect.void);
};

export {activate};

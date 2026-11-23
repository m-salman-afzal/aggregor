import {AgentController} from "@controllers/agent.controller.ts";
import {AppController} from "@controllers/app.controller.ts";
import {CommitMessageController} from "@controllers/commitMessage.controller.ts";
import {FolderShellController} from "@controllers/folderShell.controller.ts";
import {ProjectController} from "@controllers/project.controller.ts";
import {PullRequestController} from "@controllers/pullRequest.controller.ts";
import {RequiredToolsController} from "@controllers/requiredTools.controller.ts";
import {ReviewCommentController} from "@controllers/reviewComment.controller.ts";
import {SessionController} from "@controllers/session.controller.ts";
import {SessionAlertController} from "@controllers/sessionAlert.controller.ts";
import {SessionImportController} from "@controllers/sessionImport.controller.ts";
import {SessionProcessController} from "@controllers/sessionProcess.controller.ts";
import {WorktreeController} from "@controllers/worktree.controller.ts";
import {ApplicationLayer} from "@di/app.layer.ts";
import {TraceLogLayer} from "@logger/traceLog.layer.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {FolderShellProfileView} from "@views/folderShellProfile/folderShellProfile.view.ts";
import {GitHubCliNoticesView} from "@views/gitHubCliNotices/gitHubCliNotices.view.ts";
import {RequiredToolsNoticesView} from "@views/requiredToolsNotices/requiredToolsNotices.view.ts";
import {ReviewCommentsView} from "@views/reviewComments/reviewComments.view.ts";
import {SessionAlertsView} from "@views/sessionAlerts/sessionAlerts.view.ts";
import {SessionsView} from "@views/sessions/sessions.view.ts";
import {Effect, Layer, ManagedRuntime} from "effect";

import type {ExtensionContext} from "vscode";

const PresentationLayer = Layer.mergeAll(
  AgentController.layer,
  AppController.layer,
  CommitMessageController.layer,
  FolderShellController.layer,
  ProjectController.layer,
  PullRequestController.layer,
  RequiredToolsController.layer,
  ReviewCommentController.layer,
  SessionController.layer,
  SessionAlertController.layer,
  SessionImportController.layer,
  SessionProcessController.layer,
  WorktreeController.layer,
  SessionsView.layer,
  SessionAlertsView.layer,
  GitHubCliNoticesView.layer,
  RequiredToolsNoticesView.layer,
  FolderShellProfileView.layer,
  ReviewCommentsView.layer
).pipe(Layer.withSpan("Presentation"), Layer.provide([ApplicationLayer, VscodeUtils.layer]));

let activeRuntime: {readonly dispose: () => Promise<void>} | undefined;

// eslint-disable-next-line no-restricted-syntax -- VS Code's entry point, which runs the runtime itself
const activate = (extensionContext: ExtensionContext) => {
  // TraceLogLayer goes under everything, so every layer's startup work is traced and logged too.
  const runtime = ManagedRuntime.make(
    PresentationLayer.pipe(Layer.provide(TraceLogLayer), Layer.provide(VsCodeApi.layer(extensionContext)))
  );
  activeRuntime = runtime;

  // The runtime builds lazily; build it now so commands and views exist before activation finishes.
  return runtime.runPromise(Effect.void);
};

// VS Code awaits deactivate's promise but drops a subscription's, so only here do finalizers (notify-send's kill) finish.
// eslint-disable-next-line no-restricted-syntax -- VS Code's exit point, which disposes the runtime itself
const deactivate = () => (activeRuntime === undefined ? Promise.resolve() : activeRuntime.dispose());

export {activate, deactivate};

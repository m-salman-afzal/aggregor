import {SettingsConfig} from "@config/settings.config.ts";
import {DatabaseLayer} from "@di/database.layer.ts";
import {NodeServices} from "@effect/platform-node";
import {CommitCliInfraService} from "@infraServices/commitCli/commitCli.infraService.ts";
import {DesktopNotificationInfraService} from "@infraServices/os/desktopNotification.infraService.ts";
import {ShellCommandInfraService} from "@infraServices/os/shellCommand.infraService.ts";
import {TmuxInfraService} from "@infraServices/tmux/tmux.infraService.ts";
import {GitInfraService} from "@infraServices/vscode/git.infraService.ts";
import {ProgressInfraService} from "@infraServices/vscode/progress.infraService.ts";
import {TerminalInfraService} from "@infraServices/vscode/terminal/terminal.infraService.ts";
import {UserInputPromptInfraService} from "@infraServices/vscode/userInputPrompt.infraService.ts";
import {WorkspaceInfraService} from "@infraServices/vscode/workspace.infraService.ts";
import {AgentRepository} from "@repositories/agent.repository.ts";
import {ProjectRepository} from "@repositories/project.repository.ts";
import {SessionRepository} from "@repositories/session.repository.ts";
import {startSessionTabNameSync, startSessionTitleSync, startViewedAtSync} from "@services/session.service.ts";
import {startSessionReopenAfterReload, startShownProjectSync} from "@services/workspace.service.ts";
import {Layer} from "effect";
import {SecureRandom} from "effect/crypto";

const IndependentLayers = Layer.mergeAll(
  GitInfraService,
  NodeServices.layer,
  ProgressInfraService,
  UserInputPromptInfraService,
  SecureRandom.layerWebCrypto,
  SettingsConfig
);

// What runs in the background for the window's whole life.
const BackgroundLayer = Layer.mergeAll(
  Layer.effectDiscard(startSessionTitleSync()),
  Layer.effectDiscard(startSessionTabNameSync()),
  Layer.effectDiscard(startViewedAtSync()),
  Layer.effectDiscard(startShownProjectSync()),
  Layer.effectDiscard(startSessionReopenAfterReload())
);

// Everything the commands and views run on. It still needs VsCodeApi, and the trace log underneath.
export const AppLayer = BackgroundLayer.pipe(
  Layer.provideMerge(TerminalInfraService),
  Layer.provideMerge(TmuxInfraService),
  Layer.provideMerge(AgentRepository),
  Layer.provideMerge(SessionRepository),
  Layer.provideMerge(ProjectRepository),
  Layer.provideMerge(DatabaseLayer),
  Layer.provideMerge(CommitCliInfraService),
  Layer.provideMerge(DesktopNotificationInfraService),
  Layer.provideMerge(ShellCommandInfraService),
  Layer.provideMerge(WorkspaceInfraService),
  Layer.provideMerge(IndependentLayers)
);

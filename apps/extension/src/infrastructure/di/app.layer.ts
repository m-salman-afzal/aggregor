import {SettingsConfig} from "@config/settings.config.ts";
import {DatabaseLayer} from "@di/database.layer.ts";
import {NodeServices} from "@effect/platform-node";
import {AgentHistoryInfraService} from "@infraServices/agentHistory/agentHistory.infraService.ts";
import {CommitCliInfraService} from "@infraServices/commitCli/commitCli.infraService.ts";
import {WorktreeInfraService} from "@infraServices/git/worktree.infraService.ts";
import {GitHubCliInfraService} from "@infraServices/gitHubCli/gitHubCli.infraService.ts";
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
import {
  startFolderShellEndOnTerminalClose,
  startFolderShellFollow,
  syncFolderShellTerminalWithTmux
} from "@services/folderShell.service.ts";
import {startPullRequestRefreshOnTurnEnd} from "@services/pullRequest.service.ts";
import {
  startRunStateSync,
  startSessionTabNameSync,
  startSessionTitleSync,
  startViewedAtSync,
  syncSessionTabsWithTmux
} from "@services/session.service.ts";
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

const BackgroundLayer = Layer.mergeAll(
  Layer.effectDiscard(startSessionTitleSync()),
  Layer.effectDiscard(startSessionTabNameSync()),
  Layer.effectDiscard(startViewedAtSync()),
  Layer.effectDiscard(startRunStateSync()),
  Layer.effectDiscard(startPullRequestRefreshOnTurnEnd()),
  Layer.effectDiscard(startShownProjectSync()),
  Layer.effectDiscard(syncFolderShellTerminalWithTmux()),
  Layer.effectDiscard(startFolderShellFollow()),
  Layer.effectDiscard(startFolderShellEndOnTerminalClose()),
  Layer.effectDiscard(startSessionReopenAfterReload())
);

// It still needs VsCodeApi, and the trace log underneath.
export const AppLayer = BackgroundLayer.pipe(
  // Before the background jobs, which read the session in view as they start.
  Layer.provideMerge(Layer.effectDiscard(syncSessionTabsWithTmux())),
  Layer.provideMerge(TerminalInfraService),
  Layer.provideMerge(TmuxInfraService),
  Layer.provideMerge(GitHubCliInfraService),
  Layer.provideMerge(AgentRepository),
  Layer.provideMerge(SessionRepository),
  Layer.provideMerge(ProjectRepository),
  Layer.provideMerge(DatabaseLayer),
  Layer.provideMerge(AgentHistoryInfraService),
  Layer.provideMerge(CommitCliInfraService),
  Layer.provideMerge(DesktopNotificationInfraService),
  Layer.provideMerge(ShellCommandInfraService),
  Layer.provideMerge(WorkspaceInfraService),
  Layer.provideMerge(WorktreeInfraService),
  Layer.provideMerge(IndependentLayers)
);

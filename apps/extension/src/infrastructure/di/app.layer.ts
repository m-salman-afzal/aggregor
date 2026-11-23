import {SettingsConfig} from "@config/settings.config.ts";
import {BackgroundJobs} from "@di/backgroundJobs.layer.ts";
import {AgentTaskDomainService} from "@domainServices/agentTask.domainService.ts";
import {EntityIdDomainService} from "@domainServices/entityId.domainService.ts";
import {FolderShellDomainService} from "@domainServices/folderShell.domainService.ts";
import {PaginationDomainService} from "@domainServices/pagination.domainService.ts";
import {ReviewCommentDomainService} from "@domainServices/reviewComment.domainService.ts";
import {SessionDomainService} from "@domainServices/session.domainService.ts";
import {SortOrderDomainService} from "@domainServices/sortOrder.domainService.ts";
import {WorktreeDomainService} from "@domainServices/worktree.domainService.ts";
import {NodeServices} from "@effect/platform-node";
import {AgentHistoryInfraService} from "@infraServices/agentHistory/agentHistory.infraService.ts";
import {CommitCliInfraService} from "@infraServices/commitCli/commitCli.infraService.ts";
import {WorktreeInfraService} from "@infraServices/git/worktree.infraService.ts";
import {GitHubCliInfraService} from "@infraServices/gitHubCli/gitHubCli.infraService.ts";
import {DesktopNotificationInfraService} from "@infraServices/os/desktopNotification.infraService.ts";
import {ShellCommandInfraService} from "@infraServices/os/shellCommand.infraService.ts";
import {ProcessInfraService} from "@infraServices/process/process.infraService.ts";
import {TmuxInfraService} from "@infraServices/tmux/tmux.infraService.ts";
import {GitInfraService} from "@infraServices/vscode/git.infraService.ts";
import {ProgressInfraService} from "@infraServices/vscode/progress.infraService.ts";
import {TerminalInfraService} from "@infraServices/vscode/terminal/terminal.infraService.ts";
import {UserInputPromptInfraService} from "@infraServices/vscode/userInputPrompt.infraService.ts";
import {WorkspaceInfraService} from "@infraServices/vscode/workspace.infraService.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {AgentRepository} from "@repositories/agent.repository.ts";
import {ProjectRepository} from "@repositories/project.repository.ts";
import {ReviewCommentRepository} from "@repositories/reviewComment.repository.ts";
import {SessionRepository} from "@repositories/session.repository.ts";
import {AgentService} from "@services/agent.service.ts";
import {CommitMessageService} from "@services/commitMessage.service.ts";
import {FolderShellService} from "@services/folderShell.service.ts";
import {ProjectService} from "@services/project.service.ts";
import {PullRequestService} from "@services/pullRequest.service.ts";
import {RequiredToolsService} from "@services/requiredTools.service.ts";
import {ReviewCommentService} from "@services/reviewComment.service.ts";
import {SessionService} from "@services/session.service.ts";
import {SessionAlertService} from "@services/sessionAlert.service.ts";
import {SessionImportService} from "@services/sessionImport.service.ts";
import {SessionProcessService} from "@services/sessionProcess.service.ts";
import {WorkspaceService} from "@services/workspace.service.ts";
import {WorktreeService} from "@services/worktree.service.ts";
import {Layer} from "effect";
import {SecureRandom} from "effect/crypto";

import type {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";

const DomainLayer = Layer.mergeAll(
  AgentTaskDomainService.layer,
  EntityIdDomainService.layer,
  FolderShellDomainService.layer,
  PaginationDomainService.layer,
  ReviewCommentDomainService.layer,
  SessionDomainService.layer,
  SortOrderDomainService.layer,
  WorktreeDomainService.layer
).pipe(Layer.withSpan("Domain"), Layer.provide(SecureRandom.layerWebCrypto));

const InfrastructureLayer = Layer.mergeAll(
  AgentHistoryInfraService.layer,
  AgentRepository.layer,
  CommitCliInfraService.layer,
  DesktopNotificationInfraService.layer,
  GitHubCliInfraService.layer,
  GitInfraService.layer,
  ProcessInfraService.layer,
  ProgressInfraService.layer,
  ProjectRepository.layer,
  ReviewCommentRepository.layer,
  SessionRepository.layer,
  SettingsConfig.layer,
  ShellCommandInfraService.layer,
  TerminalInfraService.layer,
  TmuxInfraService.layer,
  UserInputPromptInfraService.layer,
  WorkspaceInfraService.layer,
  WorktreeInfraService.layer
).pipe(Layer.withSpan("Infrastructure"), Layer.provide([DomainLayer, VscodeUtils.layer])) satisfies Layer.Layer<
  never,
  unknown,
  VsCodeApi
>;

export const ApplicationLayer = Layer.mergeAll(
  AgentService.layer,
  CommitMessageService.layer,
  FolderShellService.layer,
  ProjectService.layer,
  PullRequestService.layer,
  RequiredToolsService.layer,
  ReviewCommentService.layer,
  SessionService.layer,
  SessionAlertService.layer,
  SessionImportService.layer,
  SessionProcessService.layer,
  WorkspaceService.layer,
  WorktreeService.layer,
  BackgroundJobs.layer
).pipe(Layer.withSpan("Application"), Layer.provide([DomainLayer, InfrastructureLayer, NodeServices.layer]));

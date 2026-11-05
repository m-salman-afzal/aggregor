import {SettingsConfig} from "@config/settings.config.ts";
import {HarnessInfraServicesLayer} from "@di/harnessInfraServices.layer.ts";
import {NodeServices} from "@effect/platform-node";
import {CommitCliInfraService} from "@infraServices/commitCli/commitCli.infraService.ts";
import {GitInfraService} from "@infraServices/vscode/git.infraService.ts";
import {PromptInfraService} from "@infraServices/vscode/prompt.infraService.ts";
import {TerminalInfraService} from "@infraServices/vscode/terminal.infraService.ts";
import {WorkspaceInfraService} from "@infraServices/vscode/workspace.infraService.ts";
import {ProjectRepository} from "@repositories/project.repository.ts";
import {SessionRepository} from "@repositories/session.repository.ts";
import {startSourceControlSync} from "@services/scm.service.ts";
import {Layer} from "effect";

const IndependentLayers = Layer.mergeAll(
  GitInfraService,
  NodeServices.layer,
  PromptInfraService,
  SettingsConfig,
  WorkspaceInfraService
);

const SourceControlSyncLayer = Layer.effectDiscard(startSourceControlSync());

// Everything the commands and views run on. It still needs VsCodeApi, and the trace log underneath.
export const AppLayer = SourceControlSyncLayer.pipe(
  Layer.provideMerge(TerminalInfraService),
  Layer.provideMerge(HarnessInfraServicesLayer),
  Layer.provideMerge(SessionRepository),
  Layer.provideMerge(ProjectRepository),
  Layer.provideMerge(CommitCliInfraService),
  Layer.provideMerge(IndependentLayers)
);

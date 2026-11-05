import {startSourceControlSync} from "@/application/scm/scm.service.ts";
import {SettingsConfig} from "@/infrastructure/config/settings.config.ts";
import {HarnessInfraServicesLayer} from "@/infrastructure/di/harnessInfraServices.layer.ts";
import {ProjectRepository} from "@/infrastructure/repositories/project.repository.ts";
import {SessionRepository} from "@/infrastructure/repositories/session.repository.ts";
import {CommitCliInfraService} from "@/infrastructure/services/commitCli/commitCli.infraService.ts";
import {GitInfraService} from "@/infrastructure/services/vscode/git.infraService.ts";
import {PromptInfraService} from "@/infrastructure/services/vscode/prompt.infraService.ts";
import {TerminalInfraService} from "@/infrastructure/services/vscode/terminal.infraService.ts";
import {WorkspaceInfraService} from "@/infrastructure/services/vscode/workspace.infraService.ts";
import {NodeServices} from "@effect/platform-node";
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

import {startSourceControlSync} from "@/application/scm/scm.service.ts";
import {CommitCliClientOnChildProcess} from "@/infrastructure/clients/commit-cli/commit-cli.client.ts";
import {GitClientOnVsCode} from "@/infrastructure/clients/vscode/git.client.ts";
import {PromptClientOnVsCode} from "@/infrastructure/clients/vscode/prompt.client.ts";
import {TerminalClientOnVsCode} from "@/infrastructure/clients/vscode/terminal.client.ts";
import {WorkspaceClientOnVsCode} from "@/infrastructure/clients/vscode/workspace.client.ts";
import {SettingsClientOnVsCode} from "@/infrastructure/config/settings.client.ts";
import {HarnessesLayer} from "@/infrastructure/di/harnesses.layer.ts";
import {RepoRepositoryOnWorkspaceState} from "@/infrastructure/repositories/repo.repository.ts";
import {SessionRepositoryOnGlobalState} from "@/infrastructure/repositories/session.repository.ts";
import {NodeServices} from "@effect/platform-node";
import {Layer} from "effect";

const IndependentLayers = Layer.mergeAll(
  GitClientOnVsCode,
  NodeServices.layer,
  PromptClientOnVsCode,
  SettingsClientOnVsCode,
  WorkspaceClientOnVsCode
);

const SourceControlSyncLayer = Layer.effectDiscard(startSourceControlSync());

// Everything the commands and views run on. It still needs VsCodeService, and the trace log underneath.
export const AppLayer = SourceControlSyncLayer.pipe(
  Layer.provideMerge(TerminalClientOnVsCode),
  Layer.provideMerge(HarnessesLayer),
  Layer.provideMerge(SessionRepositoryOnGlobalState),
  Layer.provideMerge(RepoRepositoryOnWorkspaceState),
  Layer.provideMerge(CommitCliClientOnChildProcess),
  Layer.provideMerge(IndependentLayers)
);

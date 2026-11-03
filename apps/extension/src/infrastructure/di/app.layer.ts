import {PromptClientOnVsCode} from "@/infrastructure/clients/vscode/prompt.client.ts";
import {TerminalClientOnVsCode} from "@/infrastructure/clients/vscode/terminal.client.ts";
import {WorkspaceClientOnVsCode} from "@/infrastructure/clients/vscode/workspace.client.ts";
import {SettingsService} from "@/infrastructure/config/settings.service.ts";
import {RepoRepositoryOnWorkspaceState} from "@/infrastructure/repositories/repo.repository.ts";
import {SessionRepositoryOnGlobalState} from "@/infrastructure/repositories/session.repository.ts";
import {GitReposLayer} from "@/services/scm/scm.utils.ts";
import {StatusService} from "@/services/session/status.service.ts";
import {TranscriptService} from "@/services/session/transcript.service.ts";
import {NodeServices} from "@effect/platform-node";
import {Layer} from "effect";

const IndependentLayers = Layer.mergeAll(
  NodeServices.layer,
  PromptClientOnVsCode,
  SettingsService.layer,
  WorkspaceClientOnVsCode
);

// Everything the commands and views run on. It still needs VsCodeService, and the trace log underneath.
export const AppLayer = GitReposLayer.pipe(
  Layer.provideMerge(TerminalClientOnVsCode),
  Layer.provideMerge(StatusService.layer),
  Layer.provideMerge(TranscriptService.layer),
  Layer.provideMerge(SessionRepositoryOnGlobalState),
  Layer.provideMerge(RepoRepositoryOnWorkspaceState),
  Layer.provideMerge(IndependentLayers)
);

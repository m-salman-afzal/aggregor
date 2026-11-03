import {SettingsService} from "@/infrastructure/config/settings.service.ts";
import {RepoRepositoryOnWorkspaceState} from "@/infrastructure/repositories/repo.repository.ts";
import {SessionRepositoryOnGlobalState} from "@/infrastructure/repositories/session.repository.ts";
import {ErrorService} from "@/services/error.service.ts";
import {GitReposLayer} from "@/services/scm/scm.utils.ts";
import {StatusService} from "@/services/session/status.service.ts";
import {TerminalService} from "@/services/session/terminal.service.ts";
import {TranscriptService} from "@/services/session/transcript.service.ts";
import {NodeServices} from "@effect/platform-node";
import {Layer} from "effect";

const IndependentLayers = Layer.mergeAll(ErrorService.layer, SettingsService.layer, NodeServices.layer);

// Everything the commands and views run on. It still needs VsCodeService, and the trace log underneath.
export const AppLayer = GitReposLayer.pipe(
  Layer.provideMerge(TerminalService.layer),
  Layer.provideMerge(StatusService.layer),
  Layer.provideMerge(TranscriptService.layer),
  Layer.provideMerge(SessionRepositoryOnGlobalState),
  Layer.provideMerge(RepoRepositoryOnWorkspaceState),
  Layer.provideMerge(IndependentLayers)
);

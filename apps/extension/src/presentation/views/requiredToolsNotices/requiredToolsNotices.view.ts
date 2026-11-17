import {watchMissingToolsForRequiredToolsNoticesView} from "@controllers/requiredTools.controller.ts";
import {
  REQUIRED_TOOL_NEEDS,
  REQUIRED_TOOLS,
  REQUIRED_TOOLS_COMMANDS,
  REQUIRED_TOOLS_LABELS,
  REQUIRED_TOOLS_NOTICES,
  TOOL_INSTALL_PAGES
} from "@pkg/constants/src/requiredTools.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {Array, Effect, Layer, Result, Stream} from "effect";

import type {MissingToolDto, MissingToolsDto} from "@dtos/requiredTools.dto.ts";

const describeToolNeed = Effect.fn("RequiredToolsNoticesView.describeToolNeed")(function* (
  missingTool: MissingToolDto
) {
  if (missingTool.toolName === REQUIRED_TOOLS.GITHUB_CLI) return REQUIRED_TOOL_NEEDS.gh;

  return missingTool.foundVersion === undefined
    ? REQUIRED_TOOL_NEEDS.tmux
    : REQUIRED_TOOL_NEEDS.tmuxTooOld(missingTool.foundVersion);
});

// With no package manager, each missing tool's button opens its install page.
const offerInstallPages = Effect.fn("RequiredToolsNoticesView.offerInstallPages")(function* (
  missingToolsDto: MissingToolsDto,
  toolNeeds: string
) {
  const vsCodeApi = yield* VsCodeApi;
  const pageLabels = Array.map(missingToolsDto.missingTools, (missingTool) =>
    REQUIRED_TOOLS_LABELS.INSTALL_PAGE(missingTool.toolName)
  );
  const pickedAction = yield* Effect.promise(() =>
    vsCodeApi.window.showInformationMessage(
      REQUIRED_TOOLS_NOTICES.MISSING_WITHOUT_PACKAGE_MANAGER(toolNeeds),
      ...pageLabels
    )
  );
  const pickedTool = Result.fromOption(
    Array.findFirst(
      missingToolsDto.missingTools,
      (missingTool) => REQUIRED_TOOLS_LABELS.INSTALL_PAGE(missingTool.toolName) === pickedAction
    ),
    () => undefined
  );
  if (Result.isFailure(pickedTool)) return;

  yield* Effect.promise(() =>
    vsCodeApi.env.openExternal(vsCodeApi.Uri.parse(TOOL_INSTALL_PAGES[pickedTool.success.toolName]))
  );
});

const offerInstall = Effect.fn("RequiredToolsNoticesView.offerInstall")(function* (missingToolsDto: MissingToolsDto) {
  const vsCodeApi = yield* VsCodeApi;
  const toolNeedList = yield* Effect.forEach(missingToolsDto.missingTools, describeToolNeed);
  const toolNeeds = Array.join(toolNeedList, " and ");
  const installCommandLine = missingToolsDto.installCommandLine;
  if (installCommandLine === undefined) {
    yield* offerInstallPages(missingToolsDto, toolNeeds);

    return;
  }
  const pickedAction = yield* Effect.promise(() =>
    vsCodeApi.window.showInformationMessage(
      REQUIRED_TOOLS_NOTICES.MISSING(toolNeeds, installCommandLine),
      REQUIRED_TOOLS_LABELS.INSTALL
    )
  );

  if (pickedAction === REQUIRED_TOOLS_LABELS.INSTALL)
    yield* Effect.promise(() => vsCodeApi.commands.executeCommand(REQUIRED_TOOLS_COMMANDS.INSTALL));
});

const makeRequiredToolsNoticesView = Effect.fn("RequiredToolsNoticesView.make")(function* () {
  const missingToolsChecks = yield* watchMissingToolsForRequiredToolsNoticesView();

  // In the background, so a notice waiting for a click holds back the next check.
  yield* Effect.forkScoped(
    Stream.runForEach(missingToolsChecks, (missingToolsDto) => Effect.forkScoped(offerInstall(missingToolsDto)))
  );
});

export const RequiredToolsNoticesView = Layer.effectDiscard(makeRequiredToolsNoticesView());

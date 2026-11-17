import {MissingToolDtoSchema, MissingToolsDtoSchema} from "@dtos/requiredTools.dto.ts";
import {IShellCommandInfraService} from "@interfaces/shellCommand.infraService.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {ITmuxInfraService} from "@interfaces/tmux.infraService.interface.ts";
import {REQUIRED_TOOLS, TOOL_INSTALL_COMMANDS} from "@pkg/constants/src/requiredTools.constant.ts";
import {Array, Effect, Result, Schema, Stream} from "effect";

import type {MissingToolDto} from "@dtos/requiredTools.dto.ts";

export class NoPackageManagerError extends Schema.TaggedError<NoPackageManagerError, {readonly brand: unique symbol}>()(
  "NoPackageManagerError",
  {}
) {}

const findMissingTmux = Effect.fn("RequiredToolsService.findMissingTmux")(function* () {
  const tmuxVersionResult = yield* Effect.result(
    ITmuxInfraService.use((tmuxInfraService) => tmuxInfraService.checkTmuxVersion)
  );

  return Result.match(tmuxVersionResult, {
    onFailure: (tmuxUnavailableError): readonly MissingToolDto[] => [
      MissingToolDtoSchema.make({foundVersion: tmuxUnavailableError.foundVersion, toolName: REQUIRED_TOOLS.TMUX})
    ],
    onSuccess: (): readonly MissingToolDto[] => []
  });
});

// Looked up afresh each time, so a tool installed since counts.
const findMissingTools = Effect.fn("RequiredToolsService.findMissingTools")(function* () {
  const missingTmux = yield* findMissingTmux();
  const installedCommands = yield* IShellCommandInfraService.use((shellCommandInfraService) =>
    shellCommandInfraService.listInstalledCommands([REQUIRED_TOOLS.GITHUB_CLI])
  );
  const missingGitHubCli = installedCommands.has(REQUIRED_TOOLS.GITHUB_CLI)
    ? []
    : [MissingToolDtoSchema.make({toolName: REQUIRED_TOOLS.GITHUB_CLI})];
  const missingTools = [...missingTmux, ...missingGitHubCli];
  yield* Effect.annotateCurrentSpan({missingTools: Array.map(missingTools, (missingTool) => missingTool.toolName)});

  return missingTools;
});

const findInstallCommandLine = Effect.fn("RequiredToolsService.findInstallCommandLine")(function* (
  missingTools: readonly MissingToolDto[]
) {
  const installedCommands = yield* IShellCommandInfraService.use((shellCommandInfraService) =>
    shellCommandInfraService.listInstalledCommands(
      Array.map(TOOL_INSTALL_COMMANDS, (installCommand) => installCommand.packageManager)
    )
  );
  const installCommand = Array.findFirst(TOOL_INSTALL_COMMANDS, (candidateCommand) =>
    installedCommands.has(candidateCommand.packageManager)
  );

  return yield* Effect.fromResult(
    Result.map(
      Result.fromOption(installCommand, () => NoPackageManagerError.make()),
      (foundCommand) =>
        Array.join(
          [
            foundCommand.installCommandLine,
            ...Array.map(missingTools, (missingTool) => foundCommand.packageNames[missingTool.toolName])
          ],
          " "
        )
    )
  );
});

// Nothing missing opens no terminal: another window, or the user by hand, may have installed it since.
export const installRequiredTools = Effect.fn("RequiredToolsService.installRequiredTools")(function* () {
  const missingTools = yield* findMissingTools();
  if (missingTools.length === 0) return;
  const installCommandLine = yield* findInstallCommandLine(missingTools);

  yield* ITerminalInfraService.use((terminalInfraService) =>
    terminalInfraService.openSetupTerminal(installCommandLine)
  );
});

const checkRequiredTools = Effect.fn("RequiredToolsService.checkRequiredTools")(function* () {
  const missingTools = yield* findMissingTools();
  const installCommandLineResult = yield* Effect.result(findInstallCommandLine(missingTools));

  return MissingToolsDtoSchema.make({
    installCommandLine: Result.getOrUndefined(installCommandLineResult),
    missingTools
  });
});

// Once when the window starts and again each time the setup terminal closes, only while something is missing.
export const watchMissingTools = Effect.fn("RequiredToolsService.watchMissingTools")(function* () {
  const terminalInfraService = yield* ITerminalInfraService;
  const toolChecks = Stream.concat(Stream.succeed(undefined), terminalInfraService.closedSetupTerminals);

  return Stream.filter(
    Stream.mapEffect(toolChecks, () => checkRequiredTools()),
    (missingToolsDto) => missingToolsDto.missingTools.length > 0
  );
});

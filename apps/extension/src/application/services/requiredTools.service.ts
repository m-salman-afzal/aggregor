import {MissingToolDtoSchema, MissingToolsDtoSchema} from "@dtos/requiredTools.dto.ts";
import {IShellCommandInfraService} from "@interfaces/shellCommand.infraService.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {ITmuxInfraService} from "@interfaces/tmux.infraService.interface.ts";
import {REQUIRED_TOOLS, TOOL_INSTALL_COMMANDS} from "@pkg/constants/src/requiredTools.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Array, Context, Effect, Layer, Result, Stream} from "effect";

import type {MissingToolDto} from "@dtos/requiredTools.dto.ts";

export class RequiredToolsServiceErrors extends TaggedErrors({
  NoPackageManagerError: {}
}) {}

export class RequiredToolsService extends Context.Service<RequiredToolsService>()(
  "aggregor-app/application/services/requiredTools.service/RequiredToolsService",
  {
    make: Effect.fn("make")(function* () {
      const shellCommandInfraService = yield* IShellCommandInfraService;
      const terminalInfraService = yield* ITerminalInfraService;
      const tmuxInfraService = yield* ITmuxInfraService;

      const findMissingTmux = Effect.fn("findMissingTmux")(function* () {
        const tmuxVersionResult = yield* Effect.result(tmuxInfraService.checkTmuxVersion);

        return Result.match(tmuxVersionResult, {
          onFailure: (tmuxUnavailableError): readonly MissingToolDto[] => [
            MissingToolDtoSchema.make({foundVersion: tmuxUnavailableError.foundVersion, toolName: REQUIRED_TOOLS.TMUX})
          ],
          onSuccess: (): readonly MissingToolDto[] => []
        });
      });

      const findMissingTools = Effect.fn("findMissingTools")(function* () {
        const missingTmux = yield* findMissingTmux();
        const installedCommands = yield* shellCommandInfraService.listInstalledCommands([REQUIRED_TOOLS.GITHUB_CLI]);
        const missingGitHubCli = installedCommands.has(REQUIRED_TOOLS.GITHUB_CLI)
          ? []
          : [MissingToolDtoSchema.make({toolName: REQUIRED_TOOLS.GITHUB_CLI})];
        const missingTools = [...missingTmux, ...missingGitHubCli];
        yield* Effect.annotateCurrentSpan({
          missingTools: Array.map(missingTools, (missingTool) => missingTool.toolName)
        });

        return missingTools;
      });

      const findInstallCommandLine = Effect.fn("findInstallCommandLine")(function* (
        missingTools: readonly MissingToolDto[]
      ) {
        const installedCommands = yield* shellCommandInfraService.listInstalledCommands(
          Array.map(TOOL_INSTALL_COMMANDS, (installCommand) => installCommand.packageManager)
        );
        const installCommand = Array.findFirst(TOOL_INSTALL_COMMANDS, (candidateCommand) =>
          installedCommands.has(candidateCommand.packageManager)
        );

        return yield* Effect.fromResult(
          Result.map(
            Result.fromOption(installCommand, () => RequiredToolsServiceErrors.NoPackageManagerError.make()),
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

      const installRequiredTools = Effect.fn("installRequiredTools")(function* () {
        const missingTools = yield* findMissingTools();
        if (missingTools.length === 0) return;
        const installCommandLine = yield* findInstallCommandLine(missingTools);

        yield* terminalInfraService.openSetupTerminal(installCommandLine);
      });

      const checkRequiredTools = Effect.fn("checkRequiredTools")(function* () {
        const missingTools = yield* findMissingTools();
        const installCommandLineResult = yield* Effect.result(findInstallCommandLine(missingTools));

        return MissingToolsDtoSchema.make({
          installCommandLine: Result.getOrUndefined(installCommandLineResult),
          missingTools
        });
      });

      const watchMissingTools = Effect.fn("watchMissingTools")(function* () {
        const toolChecks = Stream.concat(Stream.succeed(undefined), terminalInfraService.closedSetupTerminals);

        return Stream.filter(
          Stream.mapEffect(toolChecks, () => checkRequiredTools()),
          (missingToolsDto) => missingToolsDto.missingTools.length > 0
        );
      });

      return {installRequiredTools: installRequiredTools(), watchMissingTools: watchMissingTools()};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("RequiredToolsService", this.make()));
}

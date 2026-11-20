import {NodeServices} from "@effect/platform-node";
import {IShellCommandInfraService} from "@interfaces/shellCommand.infraService.interface.ts";
import {COMMAND_SEARCH, PLATFORMS} from "@pkg/constants/src/process.constant.ts";
import {Array, Config, Context, Effect, Layer, String} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";
import {platform} from "node:os";

interface CommandSearch {
  readonly commandExtensions: readonly string[];
  readonly searchFolders: readonly string[];
}

export class ShellCommandInfraService extends Context.Service<ShellCommandInfraService>()(
  "aggregor-app/infrastructure/services/os/shellCommand.infraService/ShellCommandInfraService",
  {
    make: Effect.fn("ShellCommandInfraService.make")(function* () {
      const fileSystem = yield* FileSystem;
      const path = yield* Path;

      // Windows runs a bare name through PATHEXT's endings; elsewhere the name is the file.
      const readCommandSearch = Effect.fn("ShellCommandInfraService.readCommandSearch")(function* () {
        const searchPath = yield* Config.withDefault(Config.String(COMMAND_SEARCH.PATH_ENV), "");
        const pathExtensions = yield* Config.withDefault(
          Config.String(COMMAND_SEARCH.PATH_EXTENSIONS_ENV),
          COMMAND_SEARCH.DEFAULT_PATH_EXTENSIONS
        );
        const isWindows = platform() === PLATFORMS.WINDOWS;
        const pathSeparator = isWindows ? COMMAND_SEARCH.WINDOWS_PATH_SEPARATOR : COMMAND_SEARCH.POSIX_PATH_SEPARATOR;
        const windowsExtensions = Array.map(
          String.split(COMMAND_SEARCH.WINDOWS_PATH_SEPARATOR)(pathExtensions),
          String.toLowerCase
        );
        const commandSearch: CommandSearch = {
          commandExtensions: isWindows ? ["", ...windowsExtensions] : [""],
          searchFolders: Array.filter(String.split(pathSeparator)(searchPath), (searchFolder) => searchFolder !== "")
        };

        return commandSearch;
      }, Effect.orDie);

      const isRunnableFile = Effect.fn("ShellCommandInfraService.isRunnableFile")(
        function* (filePath: string) {
          const fileInfo = yield* fileSystem.stat(filePath);

          const hasExecuteBit = Array.some(
            COMMAND_SEARCH.EXECUTE_BITS,
            (executeBit) => Math.floor(fileInfo.mode / executeBit) % 2 === 1
          );

          return fileInfo.type === "File" && (platform() === PLATFORMS.WINDOWS || hasExecuteBit);
        },
        Effect.orElseSucceed(() => false)
      );

      const isCommandInstalled = Effect.fn("ShellCommandInfraService.isCommandInstalled")(function* (
        command: string,
        commandSearch: CommandSearch
      ) {
        const candidatePaths = String.includes(path.sep)(command)
          ? [command]
          : Array.flatMap(commandSearch.searchFolders, (searchFolder) =>
              Array.map(commandSearch.commandExtensions, (commandExtension) =>
                path.join(searchFolder, `${command}${commandExtension}`)
              )
            );
        const runnableResults = yield* Effect.forEach(candidatePaths, isRunnableFile);

        return runnableResults.includes(true);
      });

      const listInstalledCommands = Effect.fn("ShellCommandInfraService.listInstalledCommands")(function* (
        commands: readonly string[]
      ) {
        const commandSearch = yield* readCommandSearch();
        const installedCommands = yield* Effect.filter(Array.dedupe(commands), (command) =>
          isCommandInstalled(command, commandSearch)
        );

        return new Set(installedCommands);
      });

      return {listInstalledCommands};
    })
  }
) {
  public static readonly layer = Layer.effect(IShellCommandInfraService, this.make()).pipe(
    Layer.provide(NodeServices.layer)
  );
}

import {IShellCommandInfraService} from "@interfaces/shellCommand.infraService.interface.ts";
import {Array, Config, Effect, Layer, String} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";
import {platform} from "node:os";

// What the lookup needs: where to search, and the endings a bare name may take.
interface CommandSearch {
  readonly commandExtensions: readonly string[];
  readonly searchFolders: readonly string[];
}

// The owner's, group's and others' execute bits in a file's mode.
const EXECUTE_BITS = [0o100, 0o010, 0o001];

// Windows runs a bare name through PATHEXT's endings; elsewhere the name is the file. Reading the environment can't fail
// with defaults in place, so a failure is a defect.
const readCommandSearch = Effect.fn("ShellCommandInfraService.readCommandSearch")(function* () {
  const searchPath = yield* Config.withDefault(Config.String("PATH"), "");
  const pathExtensions = yield* Config.withDefault(Config.String("PATHEXT"), ".COM;.EXE;.BAT;.CMD");
  const isWindows = platform() === "win32";
  const commandSearch: CommandSearch = {
    commandExtensions: isWindows ? ["", ...Array.map(String.split(";")(pathExtensions), String.toLowerCase)] : [""],
    searchFolders: Array.filter(String.split(isWindows ? ";" : ":")(searchPath), (searchFolder) => searchFolder !== "")
  };

  return commandSearch;
}, Effect.orDie);

// A file the user may run: on Windows any file, elsewhere one with an execute bit.
const isRunnableFile = Effect.fn("ShellCommandInfraService.isRunnableFile")(
  function* (filePath: string) {
    const fileSystem = yield* FileSystem;
    const fileInfo = yield* fileSystem.stat(filePath);

    const hasExecuteBit = Array.some(EXECUTE_BITS, (executeBit) => Math.floor(fileInfo.mode / executeBit) % 2 === 1);

    return fileInfo.type === "File" && (platform() === "win32" || hasExecuteBit);
  },
  Effect.orElseSucceed(() => false)
);

// A command with a folder in it runs as given; a bare name is looked up in each PATH folder.
const isCommandInstalled = Effect.fn("ShellCommandInfraService.isCommandInstalled")(function* (
  command: string,
  {commandExtensions, searchFolders}: CommandSearch
) {
  const path = yield* Path;
  const candidatePaths = String.includes(path.sep)(command)
    ? [command]
    : Array.flatMap(searchFolders, (searchFolder) =>
        Array.map(commandExtensions, (commandExtension) => path.join(searchFolder, `${command}${commandExtension}`))
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

const makeShellCommandInfraService = Effect.fn("ShellCommandInfraService.make")(function* () {
  const fileSystem = yield* FileSystem;
  const path = yield* Path;

  return {
    listInstalledCommands: (commands: readonly string[]) =>
      Effect.provideService(Effect.provideService(listInstalledCommands(commands), FileSystem, fileSystem), Path, path)
  };
});

export const ShellCommandInfraService = Layer.effect(IShellCommandInfraService, makeShellCommandInfraService());

import {PROCESS_LISTING} from "@pkg/constants/src/process.constant.ts";
import {Array, Effect, Result, String} from "effect";
import {ChildProcess} from "effect/process";

import type {ProcessDependencies} from "@infraServices/process/process.infraService.type.ts";
import type {RunningProcess} from "@interfaces/process.infraService.interface.ts";

// A process is named by its program's file, as top names it.
const parsePsLine = Effect.fn("ProcessInfraService.parsePsLine")(function* (psLine: string) {
  const psFields = Result.fromOption(String.match(PROCESS_LISTING.LINE)(psLine), () => undefined);
  if (Result.isFailure(psFields) || psFields.success.groups === undefined) return [];
  const lineGroups = psFields.success.groups;
  const commandLine = lineGroups.commandLine === undefined ? "" : lineGroups.commandLine;
  const [programPath] = String.split(" ")(commandLine);
  const runningProcess: RunningProcess = {
    commandLine,
    name: Array.lastNonEmpty(String.split("/")(programPath)),
    parentProcessId: Number(lineGroups.parentProcessId),
    processId: Number(lineGroups.processId)
  };

  return [runningProcess];
});

// No ps lists no process, so the group shows none.
export const listRunningProcesses = Effect.fn("ProcessInfraService.listRunningProcesses")(function* (
  processDependencies: ProcessDependencies
) {
  const psLines = yield* Effect.orElseSucceed(
    processDependencies.childProcessSpawner.lines(
      ChildProcess.make(PROCESS_LISTING.COMMAND, PROCESS_LISTING.ARGUMENTS)
    ),
    (): readonly string[] => []
  );
  const parsedPsLines = yield* Effect.forEach(psLines, parsePsLine);

  return Array.flatten(parsedPsLines);
});

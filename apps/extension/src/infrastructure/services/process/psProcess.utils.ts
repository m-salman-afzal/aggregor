import {NodeServices} from "@effect/platform-node";
import {PROCESS_LISTING} from "@pkg/constants/src/process.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Array, Context, Effect, Layer, Result, String} from "effect";
import {ChildProcess} from "effect/process";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";

import type {RunningProcess} from "@interfaces/process.infraService.interface.ts";

export class PsProcessUtils extends Context.Service<PsProcessUtils>()(
  "aggregor-app/infrastructure/services/process/psProcess.utils/PsProcessUtils",
  {
    make: Effect.fn("make")(function* () {
      const childProcessSpawner = yield* ChildProcessSpawner;

      // A process is named by its program's file, as top names it.
      const parsePsLine = Effect.fn("parsePsLine")(function* (psLine: string) {
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
      const listRunningProcesses = Effect.fn("listRunningProcesses")(function* () {
        const psLines = yield* Effect.orElseSucceed(
          childProcessSpawner.lines(ChildProcess.make(PROCESS_LISTING.COMMAND, PROCESS_LISTING.ARGUMENTS)),
          (): readonly string[] => []
        );
        const parsedPsLines = yield* Effect.forEach(psLines, parsePsLine);

        return Array.flatten(parsedPsLines);
      });

      return {listRunningProcesses: listRunningProcesses()};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("PsProcessUtils", this.make())).pipe(
    Layer.provide(NodeServices.layer)
  );
}

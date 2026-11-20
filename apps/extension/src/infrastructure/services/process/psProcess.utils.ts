import {NodeServices} from "@effect/platform-node";
import {PROCESS_LISTING} from "@pkg/constants/src/process.constant.ts";
import {Array, Context, Effect, Layer, Result, String} from "effect";
import {ChildProcess} from "effect/process";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";

import type {RunningProcess} from "@interfaces/process.infraService.interface.ts";

export class PsProcessUtils extends Context.Service<PsProcessUtils>()(
  "aggregor-app/infrastructure/services/process/psProcess.utils/PsProcessUtils",
  {
    make: Effect.fn("PsProcessUtils.make")(function* () {
      const childProcessSpawner = yield* ChildProcessSpawner;

      const parsePsLine = Effect.fn("PsProcessUtils.parsePsLine")(function* (psLine: string) {
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

      const listRunningProcesses = Effect.fn("PsProcessUtils.listRunningProcesses")(function* () {
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
  public static readonly layer = Layer.effect(this, this.make()).pipe(Layer.provide(NodeServices.layer));
}

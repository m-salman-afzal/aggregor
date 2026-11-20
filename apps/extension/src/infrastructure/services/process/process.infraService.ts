import {NodeServices} from "@effect/platform-node";
import {LinuxProcessUtils} from "@infraServices/process/linuxProcess.utils.ts";
import {ProcessTreeUtils} from "@infraServices/process/processTree.utils.ts";
import {PsProcessUtils} from "@infraServices/process/psProcess.utils.ts";
import {IProcessInfraService} from "@interfaces/process.infraService.interface.ts";
import {PLATFORMS} from "@pkg/constants/src/process.constant.ts";
import {Array, Context, Effect, Layer} from "effect";
import {platform} from "node:os";

import type {ProcessGroupRequest} from "@interfaces/process.infraService.interface.ts";

export class ProcessInfraService extends Context.Service<ProcessInfraService>()(
  "aggregor-app/infrastructure/services/process/process.infraService/ProcessInfraService",
  {
    make: Effect.fn("ProcessInfraService.make")(function* () {
      const linuxProcessUtils = yield* LinuxProcessUtils;
      const processTreeUtils = yield* ProcessTreeUtils;
      const psProcessUtils = yield* PsProcessUtils;

      // Where there are no cgroups, as on macOS, each root brings in its tree.
      const findTreeGroupProcessIds = Effect.fn("ProcessInfraService.findTreeGroupProcessIds")(function* (
        processGroupRequest: ProcessGroupRequest,
        parentProcessIds: ReadonlyMap<number, number>
      ) {
        const treeProcessIds = yield* Effect.forEach(processGroupRequest.rootProcessIds, (rootProcessId) =>
          processTreeUtils.collectProcessTree(rootProcessId, parentProcessIds)
        );

        return new Set(Array.flatten(treeProcessIds));
      });

      const listGroupProcesses = Effect.fn("ProcessInfraService.listGroupProcesses")(function* (
        processGroupRequest: ProcessGroupRequest
      ) {
        const runningProcesses = yield* psProcessUtils.listRunningProcesses;
        const parentProcessIds: ReadonlyMap<number, number> = new Map(
          Array.map(
            runningProcesses,
            (runningProcess) => [runningProcess.processId, runningProcess.parentProcessId] as const
          )
        );
        const groupProcessIds =
          platform() === PLATFORMS.LINUX
            ? yield* linuxProcessUtils.findLinuxGroupProcessIds(processGroupRequest, parentProcessIds)
            : yield* findTreeGroupProcessIds(processGroupRequest, parentProcessIds);

        return Array.filter(runningProcesses, (runningProcess) => groupProcessIds.has(runningProcess.processId));
      });

      return IProcessInfraService.of({listGroupProcesses});
    })
  }
) {
  public static readonly layer = Layer.effect(IProcessInfraService, this.make()).pipe(
    Layer.provide([LinuxProcessUtils.layer, ProcessTreeUtils.layer, PsProcessUtils.layer, NodeServices.layer])
  );
}

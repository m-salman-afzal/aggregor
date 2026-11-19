import {findLinuxGroupProcessIds} from "@infraServices/process/linuxProcess.utils.ts";
import {collectProcessTree} from "@infraServices/process/processTree.utils.ts";
import {listRunningProcesses} from "@infraServices/process/psProcess.utils.ts";
import {IProcessInfraService} from "@interfaces/process.infraService.interface.ts";
import {PLATFORMS} from "@pkg/constants/src/process.constant.ts";
import {Array, Effect, Layer} from "effect";
import {FileSystem} from "effect/FileSystem";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";
import {platform} from "node:os";

import type {ProcessDependencies} from "@infraServices/process/process.infraService.type.ts";
import type {ProcessGroupRequest} from "@interfaces/process.infraService.interface.ts";

// Where there are no cgroups, as on macOS, each root brings in its tree.
const findTreeGroupProcessIds = Effect.fn("ProcessInfraService.findTreeGroupProcessIds")(function* (
  processGroupRequest: ProcessGroupRequest,
  parentProcessIds: ReadonlyMap<number, number>
) {
  const treeProcessIds = yield* Effect.forEach(processGroupRequest.rootProcessIds, (rootProcessId) =>
    collectProcessTree(rootProcessId, parentProcessIds)
  );

  return new Set(Array.flatten(treeProcessIds));
});

const listGroupProcesses = Effect.fn("ProcessInfraService.listGroupProcesses")(function* (
  processDependencies: ProcessDependencies,
  processGroupRequest: ProcessGroupRequest
) {
  const runningProcesses = yield* listRunningProcesses(processDependencies);
  const parentProcessIds: ReadonlyMap<number, number> = new Map(
    Array.map(runningProcesses, (runningProcess) => [runningProcess.processId, runningProcess.parentProcessId] as const)
  );
  const groupProcessIds =
    platform() === PLATFORMS.LINUX
      ? yield* findLinuxGroupProcessIds(processDependencies, processGroupRequest, parentProcessIds)
      : yield* findTreeGroupProcessIds(processGroupRequest, parentProcessIds);

  return Array.filter(runningProcesses, (runningProcess) => groupProcessIds.has(runningProcess.processId));
});

const makeProcessInfraService = Effect.fn("ProcessInfraService.make")(function* () {
  const processDependencies: ProcessDependencies = {
    childProcessSpawner: yield* ChildProcessSpawner,
    fileSystem: yield* FileSystem
  };

  return {
    listGroupProcesses: (processGroupRequest: ProcessGroupRequest) =>
      listGroupProcesses(processDependencies, processGroupRequest)
  };
});

export const ProcessInfraService = Layer.effect(IProcessInfraService, makeProcessInfraService());

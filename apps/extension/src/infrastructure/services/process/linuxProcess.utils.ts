import {collectProcessTree} from "@infraServices/process/processTree.utils.ts";
import {LINUX_PROCESS_FILES} from "@pkg/constants/src/process.constant.ts";
import {Array, Effect, Result, Schema, String} from "effect";

import type {ProcessDependencies} from "@infraServices/process/process.infraService.type.ts";
import type {ProcessGroupRequest} from "@interfaces/process.infraService.interface.ts";

// What every root of one group is read against.
interface GroupSurroundings {
  readonly hostCgroupPath: string;
  readonly parentProcessIds: ReadonlyMap<number, number>;
}

class CgroupNotFoundError extends Schema.TaggedError<CgroupNotFoundError, {readonly brand: unique symbol}>()(
  "CgroupNotFoundError",
  {processId: Schema.Int}
) {}

// cgroup v2's one line, "0::/user.slice/…/run-p123-i456.scope".
const readCgroupPath = Effect.fn("ProcessInfraService.readCgroupPath")(function* (
  processDependencies: ProcessDependencies,
  processId: number
) {
  const cgroupText = yield* processDependencies.fileSystem.readFileString(LINUX_PROCESS_FILES.CGROUP_FILE(processId));
  const unifiedLine = Array.findFirst(String.split("\n")(cgroupText), String.startsWith("0::"));

  return yield* Effect.fromResult(
    Result.map(
      Result.fromOption(unifiedLine, () => CgroupNotFoundError.make({processId})),
      String.slice(3)
    )
  );
});

const readCgroupProcessIds = Effect.fn("ProcessInfraService.readCgroupProcessIds")(function* (
  processDependencies: ProcessDependencies,
  cgroupPath: string
) {
  const processesText = yield* processDependencies.fileSystem.readFileString(
    `${LINUX_PROCESS_FILES.CGROUP_ROOT}${cgroupPath}/${LINUX_PROCESS_FILES.CGROUP_PROCESSES_FILE}`
  );

  return Array.map(Array.filter(String.split("\n")(processesText), String.isNonEmpty), Number);
});

const findRootProcessIds = Effect.fn("ProcessInfraService.findRootProcessIds")(function* (
  processDependencies: ProcessDependencies,
  rootProcessId: number,
  groupSurroundings: GroupSurroundings
) {
  const rootCgroupPath = yield* readCgroupPath(processDependencies, rootProcessId);
  if (rootCgroupPath === groupSurroundings.hostCgroupPath)
    return yield* collectProcessTree(rootProcessId, groupSurroundings.parentProcessIds);

  return yield* readCgroupProcessIds(processDependencies, rootCgroupPath);
});

// A pane in a systemd scope of its own brings in the scope, so a process that left the pane's tree, a detached browser, counts; a root that ended meanwhile brings in nothing.
export const findLinuxGroupProcessIds = Effect.fn("ProcessInfraService.findLinuxGroupProcessIds")(function* (
  processDependencies: ProcessDependencies,
  processGroupRequest: ProcessGroupRequest,
  parentProcessIds: ReadonlyMap<number, number>
) {
  const hostCgroupPath = yield* Effect.orElseSucceed(
    readCgroupPath(processDependencies, processGroupRequest.hostProcessId),
    () => ""
  );
  const groupSurroundings: GroupSurroundings = {hostCgroupPath, parentProcessIds};
  const rootProcessIdResults = yield* Effect.forEach(processGroupRequest.rootProcessIds, (rootProcessId) =>
    Effect.result(findRootProcessIds(processDependencies, rootProcessId, groupSurroundings))
  );

  return new Set(Array.flatten(Array.getSuccesses(rootProcessIdResults)));
});

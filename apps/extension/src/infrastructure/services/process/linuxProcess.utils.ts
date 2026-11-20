import {NodeServices} from "@effect/platform-node";
import {ProcessTreeUtils} from "@infraServices/process/processTree.utils.ts";
import {LINUX_PROCESS_FILES} from "@pkg/constants/src/process.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Array, Context, Effect, Layer, Result, Schema, String} from "effect";
import {FileSystem} from "effect/FileSystem";

import type {ProcessGroupRequest} from "@interfaces/process.infraService.interface.ts";

interface GroupSurroundings {
  readonly hostCgroupPath: string;
  readonly parentProcessIds: ReadonlyMap<number, number>;
}

class LinuxProcessUtilsErrors extends TaggedErrors({
  CgroupNotFoundError: {processId: Schema.Int}
}) {}

export class LinuxProcessUtils extends Context.Service<LinuxProcessUtils>()(
  "aggregor-app/infrastructure/services/process/linuxProcess.utils/LinuxProcessUtils",
  {
    make: Effect.fn("make")(function* () {
      const fileSystem = yield* FileSystem;
      const processTreeUtils = yield* ProcessTreeUtils;

      // cgroup v2's one line, "0::/user.slice/…/run-p123-i456.scope".
      const readCgroupPath = Effect.fn("readCgroupPath")(function* (processId: number) {
        const cgroupText = yield* fileSystem.readFileString(LINUX_PROCESS_FILES.CGROUP_FILE(processId));
        const unifiedLine = Array.findFirst(String.split("\n")(cgroupText), String.startsWith("0::"));

        return yield* Effect.fromResult(
          Result.map(
            Result.fromOption(unifiedLine, () => LinuxProcessUtilsErrors.CgroupNotFoundError.make({processId})),
            String.slice(3)
          )
        );
      });

      const readCgroupProcessIds = Effect.fn("readCgroupProcessIds")(function* (cgroupPath: string) {
        const processesText = yield* fileSystem.readFileString(
          `${LINUX_PROCESS_FILES.CGROUP_ROOT}${cgroupPath}/${LINUX_PROCESS_FILES.CGROUP_PROCESSES_FILE}`
        );

        return Array.map(Array.filter(String.split("\n")(processesText), String.isNonEmpty), Number);
      });

      const findRootProcessIds = Effect.fn("findRootProcessIds")(function* (
        rootProcessId: number,
        groupSurroundings: GroupSurroundings
      ) {
        const rootCgroupPath = yield* readCgroupPath(rootProcessId);
        if (rootCgroupPath === groupSurroundings.hostCgroupPath)
          return yield* processTreeUtils.collectProcessTree(rootProcessId, groupSurroundings.parentProcessIds);

        return yield* readCgroupProcessIds(rootCgroupPath);
      });

      // A pane in a systemd scope of its own brings in the scope, so a process that left the pane's tree, a detached browser, counts; a root that ended meanwhile brings in nothing.
      const findLinuxGroupProcessIds = Effect.fn("findLinuxGroupProcessIds")(function* (
        processGroupRequest: ProcessGroupRequest,
        parentProcessIds: ReadonlyMap<number, number>
      ) {
        const hostCgroupPath = yield* Effect.orElseSucceed(readCgroupPath(processGroupRequest.hostProcessId), () => "");
        const groupSurroundings: GroupSurroundings = {hostCgroupPath, parentProcessIds};
        const rootProcessIdResults = yield* Effect.forEach(processGroupRequest.rootProcessIds, (rootProcessId) =>
          Effect.result(findRootProcessIds(rootProcessId, groupSurroundings))
        );

        return new Set(Array.flatten(Array.getSuccesses(rootProcessIdResults)));
      });

      return {findLinuxGroupProcessIds};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("LinuxProcessUtils", this.make())).pipe(
    Layer.provide([ProcessTreeUtils.layer, NodeServices.layer])
  );
}

import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Array, Context, Effect, Layer} from "effect";

export class ProcessTreeUtils extends Context.Service<ProcessTreeUtils>()(
  "aggregor-app/infrastructure/services/process/processTree.utils/ProcessTreeUtils",
  {
    make: Effect.fn("make")(function* () {
      const collectProcessTree = Effect.fn("collectProcessTree")(function* (
        rootProcessId: number,
        parentProcessIds: ReadonlyMap<number, number>
      ) {
        const parentEntries = [...parentProcessIds.entries()];
        const treeProcessIds = new Set([rootProcessId]);
        let generationProcessIds: readonly number[] = [rootProcessId];
        while (generationProcessIds.length > 0) {
          const generationParentIds = new Set(generationProcessIds);
          generationProcessIds = Array.map(
            Array.filter(
              parentEntries,
              ([processId, parentProcessId]) =>
                !treeProcessIds.has(processId) && generationParentIds.has(parentProcessId)
            ),
            ([processId]) => processId
          );
          for (const processId of generationProcessIds) treeProcessIds.add(processId);
        }

        return [...treeProcessIds];
      });

      return {collectProcessTree};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("ProcessTreeUtils", this.make()));
}

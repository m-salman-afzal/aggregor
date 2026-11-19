import {Array, Effect} from "effect";

export const collectProcessTree = Effect.fn("ProcessInfraService.collectProcessTree")(function* (
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
        ([processId, parentProcessId]) => !treeProcessIds.has(processId) && generationParentIds.has(parentProcessId)
      ),
      ([processId]) => processId
    );
    for (const processId of generationProcessIds) treeProcessIds.add(processId);
  }

  return [...treeProcessIds];
});

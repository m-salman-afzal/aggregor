import type {ProcessTreeItem} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/components/terminalProcessList/terminalProcessList.type.ts";
import type {SessionProcessDto} from "@dtos/sessionProcess.dto.ts";

// Each process under its parent, oldest first; one whose parent isn't listed starts a tree of its own.
export const buildProcessTree = (sessionProcesses: readonly SessionProcessDto[]): readonly ProcessTreeItem[] => {
  const listedProcessIds = new Set(sessionProcesses.map((sessionProcess) => sessionProcess.processId));
  const sortedProcesses = sessionProcesses.toSorted(
    (firstProcess, secondProcess) => firstProcess.processId - secondProcess.processId
  );
  const toTreeItem = (sessionProcess: SessionProcessDto): ProcessTreeItem => ({
    childItems: sortedProcesses
      .filter((childProcess) => childProcess.parentProcessId === sessionProcess.processId)
      .map(toTreeItem),
    sessionProcess
  });

  return sortedProcesses
    .filter((sessionProcess) => !listedProcessIds.has(sessionProcess.parentProcessId))
    .map(toTreeItem);
};

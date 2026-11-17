import {toggleRowKey} from "@/modules/sessions/components/userInputDialog/components/checklistSection/checklistSection.utils.ts";
import {
  takeImportedSessions,
  toAgentChecklistGroups
} from "@/modules/sessions/components/userInputDialog/components/importSessionsInput/components/importChecklist/importChecklist.utils.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";
import {useState} from "react";

import type {ImportableSessionsDto} from "@dtos/sessionImport.dto.ts";

interface UseImportChecklistProps {
  readonly importableSessions: ImportableSessionsDto;
}

// Nothing starts ticked: the user picks which conversations become sessions.
export const useImportChecklist = (props: UseImportChecklistProps) => {
  const agentChecklistGroups = toAgentChecklistGroups(props.importableSessions);
  const allRowKeys = agentChecklistGroups.flatMap((agentChecklistGroup) =>
    agentChecklistGroup.checklistRows.map((checklistRow) => checklistRow.rowKey)
  );
  const importChosenSessions = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.importChosenSessions
  });
  const [tickedRowKeys, setTickedRowKeys] = useState<ReadonlySet<string>>(() => new Set());
  const areAllTicked = allRowKeys.every((rowKey) => tickedRowKeys.has(rowKey));
  const importTicked = () => {
    importChosenSessions(takeImportedSessions(props.importableSessions, tickedRowKeys));
  };
  const toggleAll = () => {
    setTickedRowKeys(new Set(areAllTicked ? [] : allRowKeys));
  };
  const toggleRow = (rowKey: string) => {
    setTickedRowKeys(toggleRowKey(tickedRowKeys, rowKey));
  };

  return {
    agentChecklistGroups,
    areAllTicked,
    importTicked,
    isEmpty: allRowKeys.length === 0,
    isNothingTicked: tickedRowKeys.size === 0,
    tickedRowKeys,
    toggleAll,
    toggleRow
  };
};

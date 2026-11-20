import {toggleRowKey} from "@/modules/sessions/components/userInputDialog/components/checklistSection/checklistSection.utils.ts";
import {
  areAllRowsTicked,
  findSearchedChecklistSections,
  takeImportedSessions,
  toggleShownRowKeys
} from "@/modules/sessions/components/userInputDialog/components/importSessionsInput/components/importChecklist/importChecklist.utils.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";
import {useState} from "react";

import type {ImportableSessionsDto} from "@dtos/sessionImport.dto.ts";

interface UseImportChecklistProps {
  readonly importableSessions: ImportableSessionsDto;
}

export const useImportChecklist = (props: UseImportChecklistProps) => {
  const importChosenSessions = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.importChosenSessions
  });
  const [searchText, setSearchText] = useState("");
  const [tickedRowKeys, setTickedRowKeys] = useState<ReadonlySet<string>>(() => new Set());
  const shownChecklistSections = findSearchedChecklistSections(props.importableSessions, searchText);
  const areAllShownTicked = areAllRowsTicked(shownChecklistSections, tickedRowKeys);
  const importTicked = () => {
    importChosenSessions(takeImportedSessions(props.importableSessions, tickedRowKeys));
  };
  const toggleAll = () => {
    setTickedRowKeys(toggleShownRowKeys(tickedRowKeys, shownChecklistSections));
  };
  const toggleRow = (rowKey: string) => {
    setTickedRowKeys(toggleRowKey(tickedRowKeys, rowKey));
  };

  return {
    areAllShownTicked,
    changeSearchText: setSearchText,
    importTicked,
    isEmpty: props.importableSessions.agentGroups.length === 0,
    isNothingTicked: tickedRowKeys.size === 0,
    searchText,
    shownChecklistSections,
    tickedRowKeys,
    toggleAll,
    toggleRow
  };
};

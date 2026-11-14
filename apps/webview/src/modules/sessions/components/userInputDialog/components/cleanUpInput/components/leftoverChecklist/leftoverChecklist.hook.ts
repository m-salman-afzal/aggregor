import {
  takeChosenLeftovers,
  toBranchRows,
  toggleRowKey,
  toWorktreeRows
} from "@/modules/sessions/components/userInputDialog/components/cleanUpInput/components/leftoverChecklist/leftoverChecklist.utils.ts";
import {useState} from "react";

import type {ChosenLeftovers} from "@/modules/sessions/sessions.type.ts";
import type {ProjectLeftoversDto} from "@dtos/worktree.dto.ts";

interface UseLeftoverChecklistProps {
  readonly leftovers: ProjectLeftoversDto;
  readonly onDelete: (chosenLeftovers: ChosenLeftovers) => void;
}

// Only what is merged starts ticked, so a branch whose work never landed goes only when the user picks it.
export const useLeftoverChecklist = (props: UseLeftoverChecklistProps) => {
  const worktreeRows = toWorktreeRows(props.leftovers);
  const branchRows = toBranchRows(props.leftovers);
  const selectableRows = [...worktreeRows, ...branchRows].filter((leftoverRow) => !leftoverRow.isDisabled);
  const [tickedRowKeys, setTickedRowKeys] = useState<ReadonlySet<string>>(
    () => new Set(selectableRows.filter((leftoverRow) => leftoverRow.isMerged).map((leftoverRow) => leftoverRow.rowKey))
  );
  const areAllTicked = selectableRows.every((leftoverRow) => tickedRowKeys.has(leftoverRow.rowKey));

  return {
    areAllTicked,
    branchRows,
    deleteTicked: () => {
      props.onDelete(takeChosenLeftovers(props.leftovers, tickedRowKeys));
    },
    isEmpty: worktreeRows.length + branchRows.length === 0,
    isNothingTicked: tickedRowKeys.size === 0,
    tickedRowKeys,
    toggleAll: () => {
      setTickedRowKeys(new Set(areAllTicked ? [] : selectableRows.map((leftoverRow) => leftoverRow.rowKey)));
    },
    toggleRow: (rowKey: string) => {
      setTickedRowKeys(toggleRowKey(tickedRowKeys, rowKey));
    },
    worktreeRows
  };
};

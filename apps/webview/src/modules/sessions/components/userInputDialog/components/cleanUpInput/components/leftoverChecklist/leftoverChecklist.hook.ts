import {useState} from "react";

import {toggleRowKey} from "@/modules/sessions/components/userInputDialog/components/checklistSection/checklistSection.utils.ts";
import {
  makeLeftoverBranchRows,
  makeLeftoverWorktreeRows,
  takeChosenLeftovers
} from "@/modules/sessions/components/userInputDialog/components/cleanUpInput/components/leftoverChecklist/leftoverChecklist.utils.ts";

import type {ProjectLeftoversDto} from "@/dtos/worktree.dto.ts";
import type {ChosenLeftovers} from "@/modules/sessions/sessions.type.ts";

interface UseLeftoverChecklistProps {
  readonly leftovers: ProjectLeftoversDto;
  readonly onDelete: (chosenLeftovers: ChosenLeftovers) => void;
}

export const useLeftoverChecklist = (props: UseLeftoverChecklistProps) => {
  const worktreeRows = makeLeftoverWorktreeRows(props.leftovers);
  const branchRows = makeLeftoverBranchRows(props.leftovers);
  const selectableRows = [...worktreeRows, ...branchRows].filter((leftoverRow) => !leftoverRow.isDisabled);
  const [tickedRowKeys, setTickedRowKeys] = useState<ReadonlySet<string>>(
    () => new Set(selectableRows.filter((leftoverRow) => leftoverRow.isMerged).map((leftoverRow) => leftoverRow.rowKey))
  );
  const areAllTicked = selectableRows.every((leftoverRow) => tickedRowKeys.has(leftoverRow.rowKey));
  const deleteTicked = () => {
    props.onDelete(takeChosenLeftovers(props.leftovers, tickedRowKeys));
  };
  const toggleAll = () => {
    setTickedRowKeys(new Set(areAllTicked ? [] : selectableRows.map((leftoverRow) => leftoverRow.rowKey)));
  };
  const toggleRow = (rowKey: string) => {
    setTickedRowKeys(toggleRowKey(tickedRowKeys, rowKey));
  };

  return {
    areAllTicked,
    branchRows,
    deleteTicked,
    isEmpty: worktreeRows.length + branchRows.length === 0,
    isNothingTicked: tickedRowKeys.size === 0,
    tickedRowKeys,
    toggleAll,
    toggleRow,
    worktreeRows
  };
};

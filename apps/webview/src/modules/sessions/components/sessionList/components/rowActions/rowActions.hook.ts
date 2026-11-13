import {
  ALWAYS_SHOWN_ACTION_BAR,
  HEADER_SURFACE,
  HOVER_ACTION_BAR,
  ROW_SURFACE
} from "@/modules/sessions/components/sessionList/components/rowActions/rowActions.constant.ts";
import {toMenuGroups} from "@/modules/sessions/components/sessionList/components/rowActions/rowActions.utils.ts";
import {runCommandOnHost} from "@/modules/sessions/sessions.service.ts";

import type {RowAction} from "@/modules/sessions/sessions.type.ts";

interface UseRowActionsProps {
  readonly actionGroups: readonly (readonly RowAction[])[];
  readonly areActionsAlwaysShown?: boolean | undefined;
  readonly nodeId?: string | undefined;
}

export const useRowActions = (props: UseRowActionsProps) => {
  const isHeader = props.areActionsAlwaysShown === true;

  return {
    actionBarClassName: isHeader ? ALWAYS_SHOWN_ACTION_BAR : HOVER_ACTION_BAR,
    menuGroups: toMenuGroups(props.actionGroups),
    rowClassName: isHeader ? HEADER_SURFACE : ROW_SURFACE,
    runAction: (rowAction: RowAction) => {
      runCommandOnHost(rowAction.commandId, props.nodeId);
    }
  };
};

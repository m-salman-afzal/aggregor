import {
  ALWAYS_SHOWN_ACTION_BAR,
  HEADER_SURFACE,
  HOVER_ACTION_BAR,
  ROW_SURFACE
} from "@/modules/sessions/components/sessionList/components/rowActions/rowActions.constant.ts";
import {
  runRowActionAsking,
  toMenuGroups
} from "@/modules/sessions/components/sessionList/components/rowActions/rowActions.utils.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";

import type {RowAction} from "@/modules/sessions/sessions.type.ts";
import type {RowCommandArgument} from "@views/sessions/sessions.view.type.ts";

interface UseRowActionsProps {
  readonly actionGroups: readonly (readonly RowAction[])[];
  readonly areActionsAlwaysShown?: boolean | undefined;
  readonly commandArgument?: RowCommandArgument | undefined;
}

export const useRowActions = (props: UseRowActionsProps) => {
  const isHeader = props.areActionsAlwaysShown === true;
  const agentRows = useSessionsStore({selectFromState: (sessionsState) => sessionsState.agentRows});
  const archiveProjectRows = useSessionsStore({selectFromState: (sessionsState) => sessionsState.archiveProjectRows});
  const projectRows = useSessionsStore({selectFromState: (sessionsState) => sessionsState.projectRows});
  const showUserInput = useSessionsStore({selectFromState: (sessionsState) => sessionsState.showUserInput});
  const skipAgentPicker = useSessionsStore({selectFromState: (sessionsState) => sessionsState.skipAgentPicker});

  return {
    actionBarClassName: isHeader ? ALWAYS_SHOWN_ACTION_BAR : HOVER_ACTION_BAR,
    menuGroups: toMenuGroups(props.actionGroups),
    rowClassName: isHeader ? HEADER_SURFACE : ROW_SURFACE,
    runAction: (rowAction: RowAction) => {
      runRowActionAsking(
        {agentRows, archiveProjectRows, projectRows, showUserInput, skipAgentPicker},
        rowAction,
        props.commandArgument
      );
    }
  };
};

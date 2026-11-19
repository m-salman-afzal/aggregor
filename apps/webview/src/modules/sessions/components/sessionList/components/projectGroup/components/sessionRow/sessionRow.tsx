import {SessionDropdown} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/sessionDropdown.tsx";
import {SessionDropdownToggle} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdownToggle.tsx";
import {SessionOpenButton} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionOpenButton/sessionOpenButton.tsx";
import {useSessionRow} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/sessionRow.hook.ts";
import {RowActions} from "@/modules/sessions/components/sessionList/components/rowActions/rowActions.tsx";
import {Collapsible} from "@pkg/ui/src/components/base/collapsible.tsx";

import type {SessionRowData} from "@views/sessions/sessions.view.type.ts";

interface SessionRowProps {
  readonly sessionRow: SessionRowData;
}

// The dropdown opens under the row, inside its list item, so the row keeps its place in the list.
export const SessionRow = (props: SessionRowProps) => {
  const sessionRowView = useSessionRow(props);

  return (
    <Collapsible onOpenChange={sessionRowView.setDropdownOpen} open={sessionRowView.isDropdownOpen} render={<li />}>
      <RowActions
        actionGroups={sessionRowView.actionGroups}
        className={sessionRowView.rowClassName}
        commandArgument={sessionRowView.commandArgument}
        inlineActions={sessionRowView.inlineActions}>
        {sessionRowView.hasDropdown && <SessionDropdownToggle />}
        <SessionOpenButton sessionRow={props.sessionRow} />
      </RowActions>
      {sessionRowView.hasDropdown && (
        <SessionDropdown
          agentIconUri={props.sessionRow.agentIconUri}
          sessionId={props.sessionRow.sessionListItem.sessionId}
          sessionTasks={props.sessionRow.sessionListItem.tasks}
        />
      )}
    </Collapsible>
  );
};

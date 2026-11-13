import {SessionDetail} from "@/modules/sessions/components/sessionList/components/projectGroup/sessionRow/components/sessionDetail.tsx";
import {SessionTitle} from "@/modules/sessions/components/sessionList/components/projectGroup/sessionRow/components/sessionTitle.tsx";
import {useSessionRow} from "@/modules/sessions/components/sessionList/components/projectGroup/sessionRow/sessionRow.hook.ts";
import {RowActions} from "@/modules/sessions/components/sessionList/components/rowActions/rowActions.tsx";

import type {SessionRowData} from "@views/sessions/sessions.view.type.ts";

interface SessionRowProps {
  readonly sessionRow: SessionRowData;
}

export const SessionRow = (props: SessionRowProps) => {
  const sessionRowView = useSessionRow(props);

  return (
    <li>
      <RowActions
        actionGroups={sessionRowView.actionGroups}
        className={sessionRowView.rowClassName}
        inlineActions={sessionRowView.inlineActions}
        nodeId={props.sessionRow.nodeId}>
        <button
          aria-current={sessionRowView.isViewed}
          className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg py-1.5 pr-2 pl-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          onClick={sessionRowView.openSession}
          title={sessionRowView.tooltip}
          type="button">
          <SessionTitle status={props.sessionRow.sessionListItem.status} title={sessionRowView.title} />
          <SessionDetail
            agentIconUri={props.sessionRow.agentIconUri}
            agentLabel={sessionRowView.agentLabel}
            detail={sessionRowView.detail}
          />
        </button>
      </RowActions>
    </li>
  );
};

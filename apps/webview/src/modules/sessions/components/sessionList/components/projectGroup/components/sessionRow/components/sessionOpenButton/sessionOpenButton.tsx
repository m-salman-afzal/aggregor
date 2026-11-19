import {SessionDetail} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionOpenButton/components/sessionDetail.tsx";
import {SessionTitle} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionOpenButton/components/sessionTitle.tsx";
import {useSessionOpenButton} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionOpenButton/sessionOpenButton.hook.ts";

import type {SessionRowData} from "@views/sessions/sessions.view.type.ts";

interface SessionOpenButtonProps {
  readonly sessionRow: SessionRowData;
}

export const SessionOpenButton = (props: SessionOpenButtonProps) => {
  const sessionOpenButtonView = useSessionOpenButton(props);

  return (
    <button
      aria-current={sessionOpenButtonView.isViewed}
      className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg py-1.5 pr-2 pl-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      onClick={sessionOpenButtonView.openSession}
      title={sessionOpenButtonView.tooltip}
      type="button">
      <SessionTitle
        agentActivity={sessionOpenButtonView.agentActivity}
        sessionListItem={props.sessionRow.sessionListItem}
      />
      <SessionDetail
        agentIconUri={props.sessionRow.agentIconUri}
        agentLabel={sessionOpenButtonView.agentLabel}
        sessionListItem={props.sessionRow.sessionListItem}
      />
    </button>
  );
};

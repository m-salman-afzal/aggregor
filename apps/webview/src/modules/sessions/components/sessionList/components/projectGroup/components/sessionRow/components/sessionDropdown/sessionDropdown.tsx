import {TerminalIcon} from "lucide-react";

import {AgentTerminalIcon} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/components/agentTerminalIcon.tsx";
import {SessionTaskList} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/components/sessionTaskList/sessionTaskList.tsx";
import {TerminalProcessList} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/components/terminalProcessList/terminalProcessList.tsx";
import {SESSION_DROPDOWN_LABELS} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/sessionDropdown.constant.ts";
import {useSessionDropdown} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/sessionDropdown.hook.ts";
import {COLLAPSIBLE_PANEL} from "@/modules/sessions/components/sessionList/sessionList.constant.ts";
import {CollapsibleContent} from "@pkg/ui/src/components/base/collapsible.tsx";

import type {SessionTaskDto} from "@/dtos/session.dto.ts";

interface SessionDropdownProps {
  readonly agentIconUri?: string | undefined;
  readonly sessionId: string;
  readonly sessionTasks: readonly SessionTaskDto[];
}

export const SessionDropdown = (props: SessionDropdownProps) => {
  const sessionDropdownView = useSessionDropdown(props);

  return (
    <CollapsibleContent className={COLLAPSIBLE_PANEL}>
      <div className="flex flex-col gap-2 pt-0.5 pr-2 pb-1.5 pl-11 text-xs">
        {props.sessionTasks.length > 0 && <SessionTaskList sessionTasks={props.sessionTasks} />}
        {sessionDropdownView.agentTerminal !== undefined && (
          <TerminalProcessList
            label={SESSION_DROPDOWN_LABELS.AGENT_TERMINAL}
            labelIcon={<AgentTerminalIcon agentIconUri={props.agentIconUri} />}
            terminalProcesses={sessionDropdownView.agentTerminal}
          />
        )}
        {sessionDropdownView.folderShell !== undefined && (
          <TerminalProcessList
            label={sessionDropdownView.folderShell.statusLabel}
            labelIcon={<TerminalIcon aria-hidden className="size-3.5 shrink-0" />}
            note={sessionDropdownView.folderShellNote}
            terminalProcesses={sessionDropdownView.folderShell}
          />
        )}
      </div>
    </CollapsibleContent>
  );
};

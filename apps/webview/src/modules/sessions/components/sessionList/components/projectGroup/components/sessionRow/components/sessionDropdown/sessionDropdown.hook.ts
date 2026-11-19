import {makeSharedShellNote} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/sessionDropdown.utils.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";

interface UseSessionDropdownProps {
  readonly sessionId: string;
}

// Until the host's first reading arrives, the dropdown shows no terminal section.
export const useSessionDropdown = (props: UseSessionDropdownProps) => {
  const sessionProcesses = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.sessionProcessesBySessionId.get(props.sessionId)
  });
  const folderShell = sessionProcesses?.folderShell;

  return {
    agentTerminal: sessionProcesses?.agentTerminal,
    folderShell,
    folderShellNote: folderShell === undefined ? undefined : makeSharedShellNote(folderShell.sharingSessionCount)
  };
};

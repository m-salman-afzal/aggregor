import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";

interface UseProjectGroupProps {
  readonly projectNodeId: string;
}

export const useProjectGroup = (props: UseProjectGroupProps) => {
  const isOpen = useSessionsStore({
    selectFromState: (sessionsState) => !sessionsState.collapsedProjectNodeIds.has(props.projectNodeId)
  });
  const setProjectOpen = useSessionsStore({selectFromState: (sessionsState) => sessionsState.setProjectOpen});

  return {
    isOpen,
    setOpen: (isNowOpen: boolean) => {
      setProjectOpen(props.projectNodeId, isNowOpen);
    }
  };
};

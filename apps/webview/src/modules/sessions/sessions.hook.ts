import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";

export const useSessions = () => {
  const isDrawn = useSessionsStore({selectFromState: (sessionsState) => sessionsState.isDrawn});

  return {isDrawn};
};

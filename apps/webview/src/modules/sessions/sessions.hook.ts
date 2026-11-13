import {runCommandOnHost} from "@/modules/sessions/sessions.service.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";
import {PROJECT_COMMANDS} from "@pkg/constants/src/project.constant.ts";

export const useSessions = () => {
  const isDrawn = useSessionsStore({selectFromState: (sessionsState) => sessionsState.isDrawn});
  const projectRows = useSessionsStore({selectFromState: (sessionsState) => sessionsState.projectRows});

  return {
    addProject: () => {
      runCommandOnHost(PROJECT_COMMANDS.ADD);
    },
    isDrawn,
    projectRows
  };
};

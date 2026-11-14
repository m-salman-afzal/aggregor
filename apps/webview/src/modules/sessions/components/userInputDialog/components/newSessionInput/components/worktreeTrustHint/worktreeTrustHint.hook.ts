import {copyPathThenManageTrust} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/worktreeTrustHint/worktreeTrustHint.utils.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";
import {useState} from "react";

interface UseWorktreeTrustHintProps {
  readonly folderPath: string;
}

export const useWorktreeTrustHint = (props: UseWorktreeTrustHintProps) => {
  const isWorkspaceTrustEnabled = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.isWorkspaceTrustEnabled
  });
  const isWorktreeTrustHintHidden = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.isWorktreeTrustHintHidden
  });
  const hideWorktreeTrustHint = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.hideWorktreeTrustHint
  });
  const [isPathCopied, setPathCopied] = useState(false);

  return {
    hide: hideWorktreeTrustHint,
    isPathCopied,
    isShown: isWorkspaceTrustEnabled && !isWorktreeTrustHintHidden,
    trustFolder: () => {
      copyPathThenManageTrust(props.folderPath, setPathCopied);
    }
  };
};

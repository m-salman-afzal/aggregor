import {SessionList} from "@/modules/sessions/components/sessionList/sessionList.tsx";
import {UserInputDialog} from "@/modules/sessions/components/userInputDialog/userInputDialog.tsx";
import {useSessions} from "@/modules/sessions/sessions.hook.ts";
import {SESSION_LISTS} from "@pkg/constants/src/sessionsView.constant.ts";

export const Sessions = () => {
  const sessionsView = useSessions();
  if (!sessionsView.isDrawn) return null;

  return (
    <main className="flex h-screen flex-col" data-accent={sessionsView.accentName}>
      <style nonce={sessionsView.styleNonce}>{sessionsView.appearanceCss}</style>
      <SessionList listId={SESSION_LISTS.SESSIONS} />
      <SessionList listId={SESSION_LISTS.ARCHIVE} />
      <UserInputDialog />
    </main>
  );
};

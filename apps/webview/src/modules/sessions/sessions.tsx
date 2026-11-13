import {PromptDialog} from "@/modules/sessions/components/promptDialog/promptDialog.tsx";
import {SessionList} from "@/modules/sessions/components/sessionList/sessionList.tsx";
import {SESSION_LISTS} from "@/modules/sessions/sessions.constant.ts";
import {useSessions} from "@/modules/sessions/sessions.hook.ts";

export const Sessions = () => {
  const sessionsView = useSessions();
  if (!sessionsView.isDrawn) return null;

  return (
    <main className="flex h-screen flex-col">
      <SessionList listId={SESSION_LISTS.SESSIONS} />
      <SessionList listId={SESSION_LISTS.ARCHIVE} />
      <PromptDialog />
    </main>
  );
};

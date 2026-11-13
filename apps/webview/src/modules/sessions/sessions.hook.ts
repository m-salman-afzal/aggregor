import {getAccentName, makeAppearanceCss} from "@/modules/sessions/sessions.utils.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";

export const useSessions = () => {
  const appearance = useSessionsStore({selectFromState: (sessionsState) => sessionsState.appearance});
  const isDrawn = useSessionsStore({selectFromState: (sessionsState) => sessionsState.isDrawn});
  const styleNonce = useSessionsStore({selectFromState: (sessionsState) => sessionsState.styleNonce});

  return {
    accentName: appearance === undefined ? undefined : getAccentName(appearance.accentColor),
    appearanceCss: appearance === undefined ? "" : makeAppearanceCss(appearance.fontSize, appearance.accentColor),
    isDrawn,
    styleNonce
  };
};

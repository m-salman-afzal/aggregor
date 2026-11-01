import {RemoveCancelled} from "@/errors/session.error.ts";
import {showErrorInBackground} from "@/services/error.utils.ts";
import {pickRepo} from "@/services/repo/repo.utils.ts";
import {StatusService} from "@/services/session/status.service.ts";
import {addSession, deleteSession, findSession} from "@/services/session/store.utils.ts";
import {TerminalService} from "@/services/session/terminal.service.ts";
import {TranscriptService} from "@/services/session/transcript.service.ts";
import {findTranscriptFilePath} from "@/services/session/transcript.utils.ts";
import {VsCodeService} from "@/services/vscode.service.ts";
import {ACTIONS, SESSION_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Match} from "effect";

import type {Repo} from "@/services/repo/repo.service.ts";
import type {Session} from "@/services/session/store.service.ts";

// The name Claude gave the conversation, or ours until it has one.
export const getSessionDisplayName = Effect.fn("getSessionDisplayName")(
  function* (session: Session) {
    return yield* TranscriptService.use((transcriptService) => transcriptService.getSessionTitle(session.id));
  },
  (effect, session) => Effect.catchTag(effect, "SessionTitleNotFound", () => Effect.succeed(session.name))
);

// A failed lookup counts as "no transcript": starting fresh is better than a resume that cannot work.
const hasTranscript = Effect.fn("hasTranscript")(
  function* (session: Session) {
    yield* findTranscriptFilePath(session.id);

    return true;
  },
  Effect.catchTag("TranscriptNotFound", () => Effect.succeed(false)),
  (effect, session) =>
    Effect.catch(effect, (lookupError) =>
      Effect.as(
        Effect.logWarning(`Could not look up the transcript of session ${session.id}; starting it fresh`, lookupError),
        false
      )
    )
);

const getClaudeArguments = Effect.fn("getClaudeArguments")(function* (session: Session) {
  return (yield* hasTranscript(session)) ? ["--resume", session.id] : ["--session-id", session.id];
});

// A session whose terminal fails to launch is removed again, so no dead row stays behind.
const openNewSessionTerminal = Effect.fn("openNewSessionTerminal")(
  function* (addedSession: Session) {
    yield* TerminalService.use((terminalService) =>
      terminalService.openSessionTerminal(addedSession, {
        claudeArguments: ["--session-id", addedSession.id],
        tabName: addedSession.name
      })
    );
  },
  (effect, addedSession) => Effect.tapError(effect, () => deleteSession(addedSession.id))
);

const startSession = Effect.fn("startSession")(function* (clickedRepo: Repo | undefined) {
  const sessionRepo = clickedRepo === undefined ? yield* pickRepo() : clickedRepo;

  yield* openNewSessionTerminal(yield* addSession(sessionRepo));
});

const relaunchSession = Effect.fn("relaunchSession")(function* (sessionId: string) {
  const session = yield* findSession(sessionId);
  const [tabName, claudeArguments] = yield* Effect.all([getSessionDisplayName(session), getClaudeArguments(session)]);

  yield* TerminalService.use((terminalService) =>
    terminalService.openSessionTerminal(session, {claudeArguments, tabName})
  );
});

const confirmRunningSessionRemoval = Effect.fn("confirmRunningSessionRemoval")(function* (session: Session) {
  const {window} = yield* VsCodeService;
  const displayName = yield* getSessionDisplayName(session);

  return yield* Effect.filterOrFail(
    Effect.promise(async () =>
      window.showWarningMessage(SESSION_MESSAGES.CONFIRM_REMOVE_RUNNING(displayName), {modal: true}, ACTIONS.REMOVE)
    ),
    (pickedAction) => pickedAction === ACTIONS.REMOVE,
    () => new RemoveCancelled()
  );
});

// Closing the tab ends the agent; a tab that closed meanwhile has nothing left to stop.
const stopSessionAgent = Effect.fn("stopSessionAgent")(
  function* (sessionId: string) {
    yield* TerminalService.use((terminalService) => terminalService.closeSessionTerminal(sessionId));
  },
  Effect.catchTag("TerminalNotFound", () => Effect.void)
);

// Confirm, then forget the session, then stop the agent, so a failed write never kills it for nothing.
const removeSessionAndStopAgent = Effect.fn("removeSessionAndStopAgent")(function* (session: Session) {
  const hasOpenTerminal = yield* TerminalService.use((terminalService) =>
    terminalService.isSessionTerminalOpen(session.id)
  );
  if (hasOpenTerminal) yield* confirmRunningSessionRemoval(session);

  yield* deleteSession(session.id);
  if (hasOpenTerminal) yield* stopSessionAgent(session.id);
  // ponytail: the dying agent's SessionEnd hook can rewrite the file after this; a few bytes per removed running
  // session. Wait for the process to exit first if the folder ever matters.
  yield* StatusService.use((statusService) => statusService.clearStatusFile(session.id));
});

// The repo row's button passes its Repo; without one, the user picks a repo. VS Code passes title-bar buttons the
// focused row, which can be a Session, so newSessionAskingForRepo drops its arguments before calling this.
export const newSession = Effect.fn("newSession")(
  function* (clickedRepo?: Repo) {
    yield* startSession(clickedRepo);
  },
  Effect.catchTag("RepoPickCancelled", () => Effect.void),
  Effect.catch((startError) =>
    showErrorInBackground(
      Match.valueTags(startError, {
        NoRepo: () => SESSION_MESSAGES.REPO_REQUIRED,
        SessionsCorrupt: () => SESSION_MESSAGES.UNREADABLE,
        SessionsSaveFailed: () => SESSION_MESSAGES.SAVE_FAILED,
        TerminalLaunchFailed: () => SESSION_MESSAGES.LAUNCH_FAILED
      })
    )
  )
);

// Focuses the session's tab, or relaunches Claude on the same conversation when the tab is gone.
export const openSession = Effect.fn("openSession")(
  function* (sessionId: string) {
    yield* TerminalService.use((terminalService) => terminalService.focusSessionTerminal(sessionId));
  },
  (effect, sessionId) => Effect.catchTag(effect, "TerminalNotFound", () => relaunchSession(sessionId)),
  Effect.catch((openError) =>
    showErrorInBackground(
      Match.valueTags(openError, {
        SessionNotFound: () => SESSION_MESSAGES.NOT_FOUND,
        TerminalLaunchFailed: () => SESSION_MESSAGES.LAUNCH_FAILED
      })
    )
  )
);

// The inline tree button passes the Session itself. Claude's transcript on disk is left alone.
export const removeSession = Effect.fn("removeSession")(
  function* (session: Session) {
    yield* removeSessionAndStopAgent(session);
  },
  Effect.catchTag("RemoveCancelled", () => Effect.void),
  Effect.catch((removeError) =>
    showErrorInBackground(
      Match.valueTags(removeError, {
        SessionsCorrupt: () => SESSION_MESSAGES.UNREADABLE,
        SessionsSaveFailed: () => SESSION_MESSAGES.SAVE_FAILED
      })
    )
  )
);

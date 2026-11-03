import {PromptClient} from "@/application/clients/prompt.client.ts";
import {TerminalClient} from "@/application/clients/terminal.client.ts";
import {RemoveCancelled} from "@/application/errors/session.error.ts";
import {pickRepo} from "@/application/repo/repo.service.ts";
import {showErrorInBackground} from "@/application/utils/error.utils.ts";
import {getNewSessionName, Session} from "@/domain/entities/session/session.entity.ts";
import {SessionRepository} from "@/domain/entities/session/session.repository.ts";
import {SessionNotFound} from "@/domain/errors/session.error.ts";
import {SessionIdSchema} from "@/domain/value-objects/session-id.value-object.ts";
import {StatusService} from "@/services/session/status.service.ts";
import {TranscriptService} from "@/services/session/transcript.service.ts";
import {findTranscriptFilePath} from "@/services/session/transcript.utils.ts";
import {ACTIONS, SESSION_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Match, Result, SubscriptionRef} from "effect";

import type {Repo} from "@/domain/entities/repo/repo.entity.ts";
import type {SessionId} from "@/domain/value-objects/session-id.value-object.ts";

export const listSessions = Effect.fn("listSessions")(function* () {
  const {sessions} = yield* SessionRepository;

  return yield* SubscriptionRef.get(sessions);
});

export const findSession = Effect.fn("findSession")(function* (sessionId: SessionId) {
  const allSessions = yield* listSessions();

  return yield* Effect.fromResult(
    Result.fromNullishOr(
      allSessions.find((session) => session.id === sessionId),
      () => new SessionNotFound({sessionId})
    )
  );
});

const addSession = Effect.fn("addSession")(function* (repo: Repo) {
  const {modifySessions} = yield* SessionRepository;
  const sessionId = yield* Effect.sync(() => SessionIdSchema.make(crypto.randomUUID()));

  return yield* modifySessions((storedSessions) => {
    const addedSession = new Session({
      harnessId: "claude-code",
      id: sessionId,
      name: getNewSessionName(repo.name, storedSessions),
      repoPath: repo.path
    });

    return [addedSession, [...storedSessions, addedSession]] as const;
  });
});

const deleteSession = Effect.fn("deleteSession")(function* (sessionId: SessionId) {
  const {modifySessions} = yield* SessionRepository;
  yield* modifySessions(
    (storedSessions) => [sessionId, storedSessions.filter((session) => session.id !== sessionId)] as const
  );
});

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
    yield* TerminalClient.use((terminalClient) =>
      terminalClient.openSessionTerminal(addedSession, {
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

const relaunchSession = Effect.fn("relaunchSession")(function* (sessionId: SessionId) {
  const session = yield* findSession(sessionId);
  const [tabName, claudeArguments] = yield* Effect.all([getSessionDisplayName(session), getClaudeArguments(session)]);

  yield* TerminalClient.use((terminalClient) =>
    terminalClient.openSessionTerminal(session, {claudeArguments, tabName})
  );
});

const confirmRunningSessionRemoval = Effect.fn("confirmRunningSessionRemoval")(function* (session: Session) {
  const {confirm} = yield* PromptClient;
  const displayName = yield* getSessionDisplayName(session);

  yield* Effect.filterOrFail(
    confirm(SESSION_MESSAGES.CONFIRM_REMOVE_RUNNING(displayName), ACTIONS.REMOVE),
    (isConfirmed) => isConfirmed,
    () => new RemoveCancelled()
  );
});

// Closing the tab ends the agent; a tab that closed meanwhile has nothing left to stop.
const stopSessionAgent = Effect.fn("stopSessionAgent")(
  function* (sessionId: SessionId) {
    yield* TerminalClient.use((terminalClient) => terminalClient.closeSessionTerminal(sessionId));
  },
  Effect.catchTag("TerminalNotFound", () => Effect.void)
);

// Confirm, then forget the session, then stop the agent, so a failed write never kills it for nothing.
const removeSessionAndStopAgent = Effect.fn("removeSessionAndStopAgent")(function* (session: Session) {
  const hasOpenTerminal = yield* TerminalClient.use((terminalClient) =>
    terminalClient.isSessionTerminalOpen(session.id)
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
  function* (sessionId: SessionId) {
    yield* TerminalClient.use((terminalClient) => terminalClient.focusSessionTerminal(sessionId));
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

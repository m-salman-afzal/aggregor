import {HarnessClient} from "@/application/clients/harness.client.ts";
import {PromptClient} from "@/application/clients/prompt.client.ts";
import {TerminalClient} from "@/application/clients/terminal.client.ts";
import {RemoveCancelled} from "@/application/errors/session.error.ts";
import {pickRepo} from "@/application/repo/repo.service.ts";
import {showErrorInBackground} from "@/application/utils/error.utils.ts";
import {withHarnessClient} from "@/application/utils/harness.utils.ts";
import {getNewSessionName, Session} from "@/domain/entities/session/session.entity.ts";
import {SessionRepository} from "@/domain/entities/session/session.repository.ts";
import {SessionNotFound} from "@/domain/errors/session.error.ts";
import {SessionIdSchema} from "@/domain/value-objects/session-id.value-object.ts";
import {ACTIONS, SESSION_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Match, Result, SubscriptionRef} from "effect";

import type {TerminalLaunch} from "@/application/clients/terminal.client.ts";
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

// The name the agent gave the conversation, or ours until it has one.
export const getSessionDisplayName = Effect.fn("getSessionDisplayName")(
  function* (session: Session) {
    return yield* withHarnessClient(
      session.harnessId,
      HarnessClient.use((harnessClient) => harnessClient.getSessionTitle(session.id))
    );
  },
  (effect, session) => Effect.catchTag(effect, "SessionTitleNotFound", () => Effect.succeed(session.name))
);

const prepareTerminalLaunch = Effect.fn("prepareTerminalLaunch")(function* (session: Session, tabName: string) {
  const harnessClient = yield* HarnessClient;
  const terminalLaunch: TerminalLaunch = {
    iconPath: harnessClient.iconPath,
    launchPlan: yield* harnessClient.prepareLaunch(session),
    tabName
  };

  return terminalLaunch;
});

const openSessionTerminal = Effect.fn("openSessionTerminal")(function* (session: Session, tabName: string) {
  const terminalLaunch = yield* withHarnessClient(session.harnessId, prepareTerminalLaunch(session, tabName));

  yield* TerminalClient.use((terminalClient) => terminalClient.openSessionTerminal(session, terminalLaunch));
});

// A session whose terminal fails to launch is removed again, so no dead row stays behind.
const openNewSessionTerminal = Effect.fn("openNewSessionTerminal")(
  function* (addedSession: Session) {
    yield* openSessionTerminal(addedSession, addedSession.name);
  },
  (effect, addedSession) => Effect.tapError(effect, () => deleteSession(addedSession.id))
);

const startSession = Effect.fn("startSession")(function* (clickedRepo: Repo | undefined) {
  const sessionRepo = clickedRepo === undefined ? yield* pickRepo() : clickedRepo;

  yield* openNewSessionTerminal(yield* addSession(sessionRepo));
});

const relaunchSession = Effect.fn("relaunchSession")(function* (sessionId: SessionId) {
  const session = yield* findSession(sessionId);

  yield* openSessionTerminal(session, yield* getSessionDisplayName(session));
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
  yield* withHarnessClient(
    session.harnessId,
    HarnessClient.use((harnessClient) => harnessClient.clearSessionStatus(session.id))
  );
});

// Starts a session in the given repo; without one, the user picks a repo.
export const newSession = Effect.fn("newSession")(
  function* (clickedRepo: Repo | undefined) {
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

// The agent's transcript on disk is left alone.
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

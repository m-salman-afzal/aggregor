import {showErrorInBackground} from "@appUtils/error.utils.ts";
import {withHarnessInfraService} from "@appUtils/harness.utils.ts";
import {getNewSessionName} from "@domainServices/session.domainService.ts";
import {SessionEntity} from "@entities/session/session.entity.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {IHarnessInfraService} from "@interfaces/harness.infraService.interface.ts";
import {IPromptInfraService} from "@interfaces/prompt.infraService.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {ACTIONS, PROJECT_LABELS, SESSION_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {pickProject} from "@services/project.service.ts";
import {SessionIdValueObjectSchema} from "@valueObjects/sessionId.valueObject.ts";
import {Array, Effect, Match, Result, Schema, SubscriptionRef} from "effect";
import {SecureRandom} from "effect/crypto";

import type {ProjectEntity} from "@entities/project/project.entity.ts";
import type {TerminalLaunchRequest} from "@interfaces/terminal.infraService.interface.ts";
import type {SessionIdValueObject} from "@valueObjects/sessionId.valueObject.ts";

class RemoveCancelledError extends Schema.TaggedError<RemoveCancelledError, {readonly brand: unique symbol}>()(
  "RemoveCancelledError",
  {}
) {}

class SessionNotFoundError extends Schema.TaggedError<SessionNotFoundError, {readonly brand: unique symbol}>()(
  "SessionNotFoundError",
  {sessionId: SessionIdValueObjectSchema}
) {}

export const listSessions = Effect.fn("SessionService.listSessions")(function* () {
  const {sessions} = yield* ISessionRepository;

  return yield* SubscriptionRef.get(sessions);
});

export const findSession = Effect.fn("SessionService.findSession")(function* (sessionId: SessionIdValueObject) {
  const allSessions = yield* listSessions();

  return yield* Effect.fromResult(
    Result.fromOption(
      Array.findFirst(allSessions, (session) => session.id === sessionId),
      () => SessionNotFoundError.make({sessionId})
    )
  );
});

// Named against the sessions as saved now, so the name is free in every window.
const appendNewSession = Effect.fn("SessionService.appendNewSession")(function* (
  project: ProjectEntity,
  sessionId: SessionIdValueObject,
  storedSessions: readonly SessionEntity[]
) {
  const addedSession = SessionEntity.make({
    harnessId: "claude-code",
    id: sessionId,
    name: yield* getNewSessionName(project.name, storedSessions),
    projectPath: project.path
  });

  return [addedSession, [...storedSessions, addedSession]] as const;
});

const addSession = Effect.fn("SessionService.addSession")(function* (project: ProjectEntity) {
  const {modifySessions} = yield* ISessionRepository;
  const {uuidV4} = yield* SecureRandom.SecureRandom;
  const sessionUuid = yield* uuidV4();
  const sessionId = SessionIdValueObjectSchema.make(sessionUuid);

  return yield* modifySessions((storedSessions) => appendNewSession(project, sessionId, storedSessions));
});

const deleteSession = Effect.fn("SessionService.deleteSession")(function* (sessionId: SessionIdValueObject) {
  const {modifySessions} = yield* ISessionRepository;
  yield* modifySessions((storedSessions) =>
    Effect.succeed([sessionId, Array.filter(storedSessions, (session) => session.id !== sessionId)] as const)
  );
});

// The name the agent gave the conversation, or ours until it has one.
export const getSessionDisplayName = Effect.fn("SessionService.getSessionDisplayName")(
  function* (session: SessionEntity) {
    return yield* withHarnessInfraService(
      session.harnessId,
      IHarnessInfraService.use((harnessInfraService) => harnessInfraService.getSessionTitle(session.id))
    );
  },
  (effect, session) => Effect.catchTag(effect, "SessionTitleNotFoundError", () => Effect.succeed(session.name))
);

const prepareTerminalLaunchRequest = Effect.fn("SessionService.prepareTerminalLaunchRequest")(function* (
  session: SessionEntity,
  tabName: string
) {
  const harnessInfraService = yield* IHarnessInfraService;
  const terminalLaunchRequest: TerminalLaunchRequest = {
    iconPath: harnessInfraService.iconPath,
    launchPlan: yield* harnessInfraService.prepareLaunch(session),
    tabName
  };

  return terminalLaunchRequest;
});

const openSessionTerminal = Effect.fn("SessionService.openSessionTerminal")(function* (
  session: SessionEntity,
  tabName: string
) {
  const terminalLaunchRequest = yield* withHarnessInfraService(
    session.harnessId,
    prepareTerminalLaunchRequest(session, tabName)
  );

  yield* ITerminalInfraService.use((terminalInfraService) =>
    terminalInfraService.openSessionTerminal(session, terminalLaunchRequest)
  );
});

// A session whose terminal fails to launch is removed again, so no dead row stays behind.
const openNewSessionTerminal = Effect.fn("SessionService.openNewSessionTerminal")(
  function* (addedSession: SessionEntity) {
    yield* openSessionTerminal(addedSession, addedSession.name);
  },
  (effect, addedSession) => Effect.tapError(effect, () => deleteSession(addedSession.id))
);

const startSession = Effect.fn("SessionService.startSession")(function* (clickedProject: ProjectEntity | undefined) {
  const sessionProject =
    clickedProject === undefined ? yield* pickProject(PROJECT_LABELS.PICK_FOR_SESSION) : clickedProject;

  const addedSession = yield* addSession(sessionProject);
  yield* openNewSessionTerminal(addedSession);
});

const relaunchSession = Effect.fn("SessionService.relaunchSession")(function* (sessionId: SessionIdValueObject) {
  const session = yield* findSession(sessionId);
  const sessionDisplayName = yield* getSessionDisplayName(session);

  yield* openSessionTerminal(session, sessionDisplayName);
});

const confirmRunningSessionRemoval = Effect.fn("SessionService.confirmRunningSessionRemoval")(function* (
  session: SessionEntity
) {
  const {confirm} = yield* IPromptInfraService;
  const displayName = yield* getSessionDisplayName(session);

  yield* Effect.filterOrFail(
    confirm(SESSION_MESSAGES.CONFIRM_REMOVE_RUNNING(displayName), ACTIONS.REMOVE),
    (isConfirmed) => isConfirmed,
    () => RemoveCancelledError.make()
  );
});

// Closing the tab ends the agent; a tab that closed meanwhile has nothing left to stop.
const stopSessionAgent = Effect.fn("SessionService.stopSessionAgent")(
  function* (sessionId: SessionIdValueObject) {
    yield* ITerminalInfraService.use((terminalInfraService) => terminalInfraService.closeSessionTerminal(sessionId));
  },
  Effect.catchTag("TerminalNotFoundError", () => Effect.void)
);

// Confirm, then forget the session, then stop the agent, so a failed write never kills it for nothing.
const removeSessionAndStopAgent = Effect.fn("SessionService.removeSessionAndStopAgent")(function* (
  session: SessionEntity
) {
  const hasOpenTerminal = yield* ITerminalInfraService.use((terminalInfraService) =>
    terminalInfraService.isSessionTerminalOpen(session.id)
  );
  if (hasOpenTerminal) yield* confirmRunningSessionRemoval(session);

  yield* deleteSession(session.id);
  if (hasOpenTerminal) yield* stopSessionAgent(session.id);
  // ponytail: the dying agent's SessionEnd hook can rewrite the file after this; a few bytes per removed running
  // session. Wait for the process to exit first if the folder ever matters.
  yield* withHarnessInfraService(
    session.harnessId,
    IHarnessInfraService.use((harnessInfraService) => harnessInfraService.clearSessionStatus(session.id))
  );
});

// Starts a session in the given project; without one, the user picks a project.
export const newSession = Effect.fn("SessionService.newSession")(
  function* (clickedProject: ProjectEntity | undefined) {
    yield* startSession(clickedProject);
  },
  Effect.catchTag("ProjectPickCancelledError", () => Effect.void),
  Effect.catch((startError) =>
    showErrorInBackground(
      Match.valueTags(startError, {
        NoProjectError: () => SESSION_MESSAGES.PROJECT_REQUIRED,
        SessionsCorruptError: () => SESSION_MESSAGES.UNREADABLE,
        SessionsSaveFailedError: () => SESSION_MESSAGES.SAVE_FAILED,
        TerminalLaunchFailedError: () => SESSION_MESSAGES.LAUNCH_FAILED
      })
    )
  )
);

// Focuses the session's tab, or relaunches Claude on the same conversation when the tab is gone.
export const openSession = Effect.fn("SessionService.openSession")(
  function* (sessionId: SessionIdValueObject) {
    yield* ITerminalInfraService.use((terminalInfraService) => terminalInfraService.focusSessionTerminal(sessionId));
  },
  (effect, sessionId) => Effect.catchTag(effect, "TerminalNotFoundError", () => relaunchSession(sessionId)),
  Effect.catch((openError) =>
    showErrorInBackground(
      Match.valueTags(openError, {
        SessionNotFoundError: () => SESSION_MESSAGES.NOT_FOUND,
        TerminalLaunchFailedError: () => SESSION_MESSAGES.LAUNCH_FAILED
      })
    )
  )
);

// The agent's transcript on disk is left alone.
export const removeSession = Effect.fn("SessionService.removeSession")(
  function* (session: SessionEntity) {
    yield* removeSessionAndStopAgent(session);
  },
  Effect.catchTag("RemoveCancelledError", () => Effect.void),
  Effect.catch((removeError) =>
    showErrorInBackground(
      Match.valueTags(removeError, {
        SessionsCorruptError: () => SESSION_MESSAGES.UNREADABLE,
        SessionsSaveFailedError: () => SESSION_MESSAGES.SAVE_FAILED
      })
    )
  )
);

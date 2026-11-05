import {showErrorInBackground} from "@appUtils/error.utils.ts";
import {withHarnessInfraService} from "@appUtils/harness.utils.ts";
import {getNewSessionName} from "@domainServices/session.domainService.ts";
import {SessionEntity} from "@entities/session/session.entity.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {IHarnessInfraService} from "@interfaces/harness.infraService.interface.ts";
import {IPromptInfraService} from "@interfaces/prompt.infraService.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {ACTIONS, PROJECT_LABELS, SESSION_LABELS, SESSION_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {pickProject} from "@services/project.service.ts";
import {SessionIdValueObjectSchema} from "@valueObjects/sessionId.valueObject.ts";
import {Array, Effect, Match, Result, Schema, Stream, String, SubscriptionRef} from "effect";
import {SecureRandom} from "effect/crypto";

import type {ProjectEntity} from "@entities/project/project.entity.ts";
import type {SessionsCorruptError, SessionsSaveFailedError} from "@entities/session/session.repository.interface.ts";
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

// Rewrites one session as saved now; a session removed meanwhile stays removed.
const updateSession = Effect.fn("SessionService.updateSession")(function* (
  sessionId: SessionIdValueObject,
  changeSession: (storedSession: SessionEntity) => SessionEntity
) {
  const {modifySessions} = yield* ISessionRepository;
  yield* modifySessions((storedSessions) =>
    Effect.succeed([
      undefined,
      Array.map(storedSessions, (storedSession) =>
        storedSession.id === sessionId ? changeSession(storedSession) : storedSession
      )
    ] as const)
  );
});

const prepareTerminalLaunchRequest = Effect.fn("SessionService.prepareTerminalLaunchRequest")(function* (
  session: SessionEntity,
  tabName: string | undefined
) {
  const harnessInfraService = yield* IHarnessInfraService;
  const terminalLaunchRequest: TerminalLaunchRequest = {
    iconPath: harnessInfraService.iconPath,
    launchPlan: yield* harnessInfraService.prepareLaunch(session),
    tabName
  };

  return terminalLaunchRequest;
});

// Only a session the user named gets a tab name; the others' tabs show the agent's own title.
const openSessionTerminal = Effect.fn("SessionService.openSessionTerminal")(function* (session: SessionEntity) {
  const tabName = session.customName;
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
    yield* openSessionTerminal(addedSession);
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

  yield* openSessionTerminal(session);
});

const confirmRunningSessionRemoval = Effect.fn("SessionService.confirmRunningSessionRemoval")(function* (
  session: SessionEntity
) {
  const {confirm} = yield* IPromptInfraService;

  yield* Effect.filterOrFail(
    confirm(SESSION_MESSAGES.CONFIRM_REMOVE_RUNNING(session.displayName), ACTIONS.REMOVE),
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

const showSessionRepositoryError = Effect.fn("SessionService.showSessionRepositoryError")(function* (
  sessionRepositoryError: SessionsCorruptError | SessionsSaveFailedError
) {
  yield* showErrorInBackground(
    Match.valueTags(sessionRepositoryError, {
      SessionsCorruptError: () => SESSION_MESSAGES.UNREADABLE,
      SessionsSaveFailedError: () => SESSION_MESSAGES.SAVE_FAILED
    })
  );
});

// The agent's title, as its tab shows it, becomes the session's name, so it outlasts the tab. A session the user named
// has a tab of that name, which is not the agent's title.
const saveSessionTitle = Effect.fn("SessionService.saveSessionTitle")(
  function* (sessionId: SessionIdValueObject, terminalTitle: string) {
    const session = yield* findSession(sessionId);
    if (session.customName !== undefined) return;
    const sessionTitle = yield* withHarnessInfraService(
      session.harnessId,
      IHarnessInfraService.use((harnessInfraService) => harnessInfraService.readSessionTitle(terminalTitle))
    );
    if (sessionTitle === session.name) return;

    yield* updateSession(sessionId, (storedSession) => storedSession.withName(sessionTitle));
  },
  Effect.catchTags({SessionNotFoundError: () => Effect.void, SessionTitleNotFoundError: () => Effect.void}),
  Effect.catch(showSessionRepositoryError)
);

// For the window's whole life, each session's name follows its agent's latest title.
export const startSessionTitleSync = Effect.fn("SessionService.startSessionTitleSync")(function* () {
  const {sessionTerminalTitles} = yield* ITerminalInfraService;

  yield* Effect.forkScoped(
    Stream.runForEach(sessionTerminalTitles, ([sessionId, terminalTitle]) => saveSessionTitle(sessionId, terminalTitle))
  );
});

// The user's name for the session wins over the agent's title in the row and the tab. An empty name hands both back to
// the agent; the open tab keeps the agent's last title until it reopens, since VS Code cannot unname a tab.
export const renameSession = Effect.fn("SessionService.renameSession")(
  function* (session: SessionEntity) {
    const enteredName = yield* IPromptInfraService.use((promptInfraService) =>
      promptInfraService.inputText(SESSION_LABELS.RENAME, session.displayName)
    );
    const trimmedName = String.trim(enteredName);
    const customName = trimmedName === "" ? undefined : trimmedName;

    yield* updateSession(session.id, (storedSession) => storedSession.withCustomName(customName));
    yield* ITerminalInfraService.use((terminalInfraService) =>
      terminalInfraService.renameSessionTerminal(session.id, customName === undefined ? session.name : customName)
    );
  },
  Effect.catchTag("InputCancelledError", () => Effect.void),
  Effect.catch(showSessionRepositoryError)
);

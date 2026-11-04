import {RemoveCancelledError, SessionNotFoundError} from "@/application/errors/session.service.error.ts";
import {IHarnessInfraService} from "@/application/interfaces/harness.infraService.interface.ts";
import {IPromptInfraService} from "@/application/interfaces/prompt.infraService.interface.ts";
import {ITerminalInfraService} from "@/application/interfaces/terminal.infraService.interface.ts";
import {pickProject} from "@/application/project/project.service.ts";
import {showErrorInBackground} from "@/application/utils/error.utils.ts";
import {withHarnessInfraService} from "@/application/utils/harness.utils.ts";
import {getNewSessionName, SessionEntity} from "@/domain/entities/session/session.entity.ts";
import {ISessionRepository} from "@/domain/entities/session/session.repository.interface.ts";
import {SessionIdValueObjectSchema} from "@/domain/valueObjects/sessionId.valueObject.ts";
import {ACTIONS, SESSION_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Match, Result, SubscriptionRef} from "effect";

import type {TerminalLaunchRequest} from "@/application/interfaces/terminal.infraService.type.ts";
import type {ProjectEntity} from "@/domain/entities/project/project.entity.ts";
import type {SessionIdValueObject} from "@/domain/valueObjects/sessionId.valueObject.ts";

export const listSessions = Effect.fn("listSessions")(function* () {
  const {sessions} = yield* ISessionRepository;

  return yield* SubscriptionRef.get(sessions);
});

export const findSession = Effect.fn("findSession")(function* (sessionId: SessionIdValueObject) {
  const allSessions = yield* listSessions();

  return yield* Effect.fromResult(
    Result.fromNullishOr(
      allSessions.find((session) => session.id === sessionId),
      () => new SessionNotFoundError({sessionId})
    )
  );
});

const addSession = Effect.fn("addSession")(function* (project: ProjectEntity) {
  const {modifySessions} = yield* ISessionRepository;
  const sessionId = yield* Effect.sync(() => SessionIdValueObjectSchema.make(crypto.randomUUID()));

  return yield* modifySessions((storedSessions) => {
    const addedSession = new SessionEntity({
      harnessId: "claude-code",
      id: sessionId,
      name: getNewSessionName(project.name, storedSessions),
      projectPath: project.path
    });

    return [addedSession, [...storedSessions, addedSession]] as const;
  });
});

const deleteSession = Effect.fn("deleteSession")(function* (sessionId: SessionIdValueObject) {
  const {modifySessions} = yield* ISessionRepository;
  yield* modifySessions(
    (storedSessions) => [sessionId, storedSessions.filter((session) => session.id !== sessionId)] as const
  );
});

// The name the agent gave the conversation, or ours until it has one.
export const getSessionDisplayName = Effect.fn("getSessionDisplayName")(
  function* (session: SessionEntity) {
    return yield* withHarnessInfraService(
      session.harnessId,
      IHarnessInfraService.use((harnessInfraService) => harnessInfraService.getSessionTitle(session.id))
    );
  },
  (effect, session) => Effect.catchTag(effect, "SessionTitleNotFoundError", () => Effect.succeed(session.name))
);

const prepareTerminalLaunchRequest = Effect.fn("prepareTerminalLaunchRequest")(function* (
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

const openSessionTerminal = Effect.fn("openSessionTerminal")(function* (session: SessionEntity, tabName: string) {
  const terminalLaunchRequest = yield* withHarnessInfraService(
    session.harnessId,
    prepareTerminalLaunchRequest(session, tabName)
  );

  yield* ITerminalInfraService.use((terminalInfraService) =>
    terminalInfraService.openSessionTerminal(session, terminalLaunchRequest)
  );
});

// A session whose terminal fails to launch is removed again, so no dead row stays behind.
const openNewSessionTerminal = Effect.fn("openNewSessionTerminal")(
  function* (addedSession: SessionEntity) {
    yield* openSessionTerminal(addedSession, addedSession.name);
  },
  (effect, addedSession) => Effect.tapError(effect, () => deleteSession(addedSession.id))
);

const startSession = Effect.fn("startSession")(function* (clickedProject: ProjectEntity | undefined) {
  const sessionProject = clickedProject === undefined ? yield* pickProject() : clickedProject;

  yield* openNewSessionTerminal(yield* addSession(sessionProject));
});

const relaunchSession = Effect.fn("relaunchSession")(function* (sessionId: SessionIdValueObject) {
  const session = yield* findSession(sessionId);

  yield* openSessionTerminal(session, yield* getSessionDisplayName(session));
});

const confirmRunningSessionRemoval = Effect.fn("confirmRunningSessionRemoval")(function* (session: SessionEntity) {
  const {confirm} = yield* IPromptInfraService;
  const displayName = yield* getSessionDisplayName(session);

  yield* Effect.filterOrFail(
    confirm(SESSION_MESSAGES.CONFIRM_REMOVE_RUNNING(displayName), ACTIONS.REMOVE),
    (isConfirmed) => isConfirmed,
    () => new RemoveCancelledError()
  );
});

// Closing the tab ends the agent; a tab that closed meanwhile has nothing left to stop.
const stopSessionAgent = Effect.fn("stopSessionAgent")(
  function* (sessionId: SessionIdValueObject) {
    yield* ITerminalInfraService.use((terminalInfraService) => terminalInfraService.closeSessionTerminal(sessionId));
  },
  Effect.catchTag("TerminalNotFoundError", () => Effect.void)
);

// Confirm, then forget the session, then stop the agent, so a failed write never kills it for nothing.
const removeSessionAndStopAgent = Effect.fn("removeSessionAndStopAgent")(function* (session: SessionEntity) {
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
export const newSession = Effect.fn("newSession")(
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
export const openSession = Effect.fn("openSession")(
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
export const removeSession = Effect.fn("removeSession")(
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

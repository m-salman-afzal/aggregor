import {getAlertedStatus} from "@domainServices/session.domainService.ts";
import {SessionAlertDtoSchema} from "@dtos/sessionAlert.dto.ts";
import {IAgentRepository} from "@entities/agent/agent.repository.interface.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {IDesktopNotificationInfraService} from "@interfaces/desktopNotification.infraService.interface.ts";
import {ISettingsConfig} from "@interfaces/settings.config.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {SESSION_ALERT_HOLD_MS} from "@pkg/constants/src/sessionAlert.constant.ts";
import {AGENT_STATUSES} from "@valueObjects/agentStatus.valueObject.ts";
import {ENTITY_CHANGE_KINDS} from "@valueObjects/entityChangeKind.valueObject.ts";
import {DateTime, Duration, Effect, Result, Schema, Stream, SubscriptionRef} from "effect";

import type {NotifyOnDesktopRequestDto} from "@dtos/sessionAlert.dto.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {AgentStatusValueObject} from "@valueObjects/agentStatus.valueObject.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

// A session's status change, and whether the user was looking at the session when it changed.
interface ObservedStatusChange {
  readonly session: SessionEntity;
  readonly wasInView: boolean;
}

// A status change that held, with the status the session held before it.
interface HeldStatusChange extends ObservedStatusChange {
  readonly previousHeldStatus: AgentStatusValueObject | undefined;
}

// The held status raises no alert: the user saw it change or is looking at it, or the notifyOn setting leaves it out.
class SessionAlertSkippedError extends Schema.TaggedError<SessionAlertSkippedError, {readonly brand: unique symbol}>()(
  "SessionAlertSkippedError",
  {}
) {}

// The session alert use cases: which states sessions out of view notify about, and the notification outside VS Code.

// The session whose tab is in front of the user in a focused window.
const isSessionInView = Effect.fn("SessionAlertService.isSessionInView")(function* (sessionId: EntityIdValueObject) {
  const terminalInfraService = yield* ITerminalInfraService;
  const viewedSessionIdResult = yield* SubscriptionRef.get(terminalInfraService.viewedSessionId);

  return Result.getOrUndefined(viewedSessionIdResult) === sessionId;
});

// aggregor-pty moves statusChangedAt only when the state changes, so a session whose status changed since the window
// started counts, and one that only kept a state it already had doesn't.
const watchChangedSessions = Effect.fn("SessionAlertService.watchChangedSessions")(function* () {
  const sessionRepository = yield* ISessionRepository;
  const alertsStartedAt = yield* DateTime.now;

  return Stream.filterMap(sessionRepository.entityChanges, (entityChange) =>
    entityChange.kind !== ENTITY_CHANGE_KINDS.REMOVED &&
    entityChange.entity.statusChangedAt !== undefined &&
    DateTime.isGreaterThan(entityChange.entity.statusChangedAt, alertsStartedAt)
      ? Result.succeed(entityChange.entity)
      : Result.failVoid
  );
});

// Title and viewedAt writes repeat the status, so only a write with another state or kind of wait is a change.
const observeStatusChanges = Effect.fn("SessionAlertService.observeStatusChanges")(function* (
  sessionWrites: Stream.Stream<SessionEntity>
) {
  const statusChanges = Stream.changesWith(
    sessionWrites,
    (previousWrite, nextWrite) =>
      previousWrite.status === nextWrite.status && previousWrite.statusKind === nextWrite.statusKind
  );

  return Stream.mapEffect(statusChanges, (session) =>
    Effect.map(isSessionInView(session.id), (wasInView): ObservedStatusChange => ({session, wasInView}))
  );
});

// A state passes once it has held for SESSION_ALERT_HOLD_MS, and only when it isn't the state that held before it.
const holdStatusChanges = Effect.fn("SessionAlertService.holdStatusChanges")(function* (
  sessionWrites: Stream.Stream<SessionEntity>
) {
  const statusChanges = yield* observeStatusChanges(sessionWrites);
  const heldChanges = Stream.debounce(statusChanges, Duration.millis(SESSION_ALERT_HOLD_MS));

  return Stream.mapAccum(
    heldChanges,
    (): SessionEntity | undefined => undefined,
    (previousHeldSession, heldChange): readonly [SessionEntity, readonly HeldStatusChange[]] => {
      if (previousHeldSession === undefined)
        return [heldChange.session, [{...heldChange, previousHeldStatus: undefined}]] as const;
      const isRepeat =
        previousHeldSession.status === heldChange.session.status &&
        previousHeldSession.statusKind === heldChange.session.statusKind;

      return [
        heldChange.session,
        isRepeat ? [] : [{...heldChange, previousHeldStatus: previousHeldSession.status}]
      ] as const;
    }
  );
});

// A failed settings read leaves the alert out, and is logged.
const readNotifyOnStatuses = Effect.fn("SessionAlertService.readNotifyOnStatuses")(
  function* () {
    const alertSettings = yield* ISettingsConfig.use((settingsConfig) => settingsConfig.readAlertSettings);

    return alertSettings.notifyOnStatuses;
  },
  Effect.catchTag("InvalidSettingsError", (settingsError) =>
    Effect.andThen(
      Effect.logWarning("Could not read aggregorApp.notifyOn", settingsError),
      SessionAlertSkippedError.make()
    )
  )
);

// Out of view means out of view both when the state changed and once it has held.
const toSessionAlert = Effect.fn("SessionAlertService.toSessionAlert")(function* (heldStatusChange: HeldStatusChange) {
  if (heldStatusChange.wasInView || (yield* isSessionInView(heldStatusChange.session.id)))
    return yield* SessionAlertSkippedError.make();
  const alertedStatus = yield* getAlertedStatus(heldStatusChange.session.status, heldStatusChange.previousHeldStatus);
  const notifyOnStatuses = yield* readNotifyOnStatuses();
  if (!notifyOnStatuses.includes(alertedStatus)) return yield* SessionAlertSkippedError.make();
  const agentResult = yield* Effect.result(
    IAgentRepository.use((agentRepository) => agentRepository.findById(heldStatusChange.session.agentId))
  );

  return SessionAlertDtoSchema.make({
    displayName: heldStatusChange.session.displayName,
    icon: Result.getOrUndefined(Result.map(agentResult, (sessionAgent) => sessionAgent.icon)),
    sessionId: heldStatusChange.session.id,
    status: alertedStatus,
    statusKind: alertedStatus === AGENT_STATUSES.BLOCKED ? heldStatusChange.session.statusKind : undefined,
    statusMessage: heldStatusChange.session.statusMessage
  });
});

// Each state a session out of view holds long enough, as the notifyOn setting picks them. Every session's changes are
// held apart, so one session's quick changes never hold back another's.
export const watchSessionAlerts = Effect.fn("SessionAlertService.watchSessionAlerts")(function* () {
  const changedSessions = yield* watchChangedSessions();
  const heldStatusChanges = Stream.flatMap(
    Stream.groupByKey(changedSessions, (changedSession) => changedSession.id),
    ([, sessionWrites]) => Stream.unwrap(holdStatusChanges(sessionWrites)),
    {concurrency: "unbounded"}
  );

  return Stream.filterMapEffect(heldStatusChanges, (heldStatusChange) =>
    Effect.result(toSessionAlert(heldStatusChange))
  );
});

export const notifyOnDesktop = Effect.fn("SessionAlertService.notifyOnDesktop")(function* (
  request: NotifyOnDesktopRequestDto
) {
  yield* IDesktopNotificationInfraService.use((desktopNotificationInfraService) =>
    desktopNotificationInfraService.notifyOnDesktop(request)
  );
});

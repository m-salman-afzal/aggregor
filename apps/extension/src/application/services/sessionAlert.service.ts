import {SessionDomainService} from "@domainServices/session.domainService.ts";
import {SessionAlertDtoSchema} from "@dtos/sessionAlert.dto.ts";
import {IAgentRepository} from "@entities/agent/agent.repository.interface.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {IDesktopNotificationInfraService} from "@interfaces/desktopNotification.infraService.interface.ts";
import {ISettingsConfig} from "@interfaces/settings.config.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {SESSION_ALERT_HOLD_MS} from "@pkg/constants/src/sessionAlert.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {AGENT_STATUSES} from "@valueObjects/agentStatus.valueObject.ts";
import {ENTITY_CHANGE_KINDS} from "@valueObjects/entityChangeKind.valueObject.ts";
import {Context, DateTime, Duration, Effect, Layer, Result, Stream, SubscriptionRef} from "effect";

import type {NotifyOnDesktopRequestDto} from "@dtos/sessionAlert.dto.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {AgentStatusValueObject} from "@valueObjects/agentStatus.valueObject.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

interface ObservedStatusChange {
  readonly session: SessionEntity;
  readonly wasInView: boolean;
}

interface HeldStatusChange extends ObservedStatusChange {
  readonly previousHeldStatus: AgentStatusValueObject | undefined;
}

class SessionAlertServiceErrors extends TaggedErrors({
  SessionAlertSkippedError: {}
}) {}

export class SessionAlertService extends Context.Service<SessionAlertService>()(
  "aggregor-app/application/services/sessionAlert.service/SessionAlertService",
  {
    make: Effect.fn("make")(function* () {
      const agentRepository = yield* IAgentRepository;
      const sessionRepository = yield* ISessionRepository;
      const desktopNotificationInfraService = yield* IDesktopNotificationInfraService;
      const settingsConfig = yield* ISettingsConfig;
      const terminalInfraService = yield* ITerminalInfraService;
      const sessionDomainService = yield* SessionDomainService;

      const isSessionInView = Effect.fn("isSessionInView")(function* (sessionId: EntityIdValueObject) {
        const viewedSessionIdResult = yield* SubscriptionRef.get(terminalInfraService.viewedSessionId);

        return Result.getOrUndefined(viewedSessionIdResult) === sessionId;
      });

      // aggregor-pty moves statusChangedAt only when the state changes, so only a change since the window started counts.
      const watchChangedSessions = Effect.fn("watchChangedSessions")(function* () {
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
      const observeStatusChanges = Effect.fn("observeStatusChanges")(function* (
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

      const holdStatusChanges = Effect.fn("holdStatusChanges")(function* (sessionWrites: Stream.Stream<SessionEntity>) {
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
      const readNotifyOnStatuses = Effect.fn("readNotifyOnStatuses")(
        function* () {
          const alertSettings = yield* settingsConfig.readAlertSettings;

          return alertSettings.notifyOnStatuses;
        },
        Effect.catchTag("InvalidSettingsError", (settingsError) =>
          Effect.andThen(
            Effect.logWarning("Could not read aggregorApp.notifyOn", settingsError),
            SessionAlertServiceErrors.SessionAlertSkippedError.make()
          )
        )
      );

      // Out of view means out of view both when the state changed and once it has held.
      const toSessionAlert = Effect.fn("toSessionAlert")(function* (heldStatusChange: HeldStatusChange) {
        if (heldStatusChange.wasInView || (yield* isSessionInView(heldStatusChange.session.id)))
          return yield* SessionAlertServiceErrors.SessionAlertSkippedError.make();
        const alertedStatus = yield* sessionDomainService.getAlertedStatus(
          heldStatusChange.session.status,
          heldStatusChange.previousHeldStatus
        );
        const notifyOnStatuses = yield* readNotifyOnStatuses();
        if (!notifyOnStatuses.includes(alertedStatus))
          return yield* SessionAlertServiceErrors.SessionAlertSkippedError.make();
        const agentResult = yield* Effect.result(agentRepository.findById(heldStatusChange.session.agentId));

        return SessionAlertDtoSchema.make({
          displayName: heldStatusChange.session.displayName,
          icon: Result.getOrUndefined(Result.map(agentResult, (sessionAgent) => sessionAgent.icon)),
          sessionId: heldStatusChange.session.id,
          status: alertedStatus,
          statusKind: alertedStatus === AGENT_STATUSES.BLOCKED ? heldStatusChange.session.statusKind : undefined,
          statusMessage: heldStatusChange.session.statusMessage
        });
      });

      // Every session's changes are held apart, so one session's quick changes never hold back another's.
      const watchSessionAlerts = Effect.fn("watchSessionAlerts")(function* () {
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

      const notifyOnDesktop = Effect.fn("notifyOnDesktop")(function* (request: NotifyOnDesktopRequestDto) {
        yield* desktopNotificationInfraService.notifyOnDesktop(request);
      });

      return {notifyOnDesktop, watchSessionAlerts: watchSessionAlerts()};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("SessionAlertService", this.make()));
}

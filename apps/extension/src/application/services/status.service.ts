import {withHarnessInfraService} from "@appUtils/harness.utils.ts";
import {IHarnessInfraService} from "@interfaces/harness.infraService.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {INTERRUPTED_TURN_GRACE} from "@pkg/constants/src/extension.constant.ts";
import {findSession} from "@services/session.service.ts";
import {Effect, FiberMap, Stream, String, SubscriptionRef} from "effect";

import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

// The agent reports no end to a turn the user interrupts, so a session still running once its title has said idle for
// INTERRUPTED_TURN_GRACE settles to idle. Only running settles, since a session waiting on the user may show the mark too.
// shortcut: a renamed session's tab shows its name, not the agent's title, so it never settles; find another signal if
// that bites.
const settleInterruptedTurn = Effect.fn("StatusService.settleInterruptedTurn")(
  function* (sessionId: EntityIdValueObject, terminalTitle: string) {
    const session = yield* findSession(sessionId);
    const {idleTitleMark, sessionStatuses, settleSessionTurn} = yield* withHarnessInfraService(
      session.harnessId,
      IHarnessInfraService.useSync((harnessInfraService) => harnessInfraService)
    );
    if (!String.startsWith(idleTitleMark)(terminalTitle)) return;

    yield* Effect.sleep(INTERRUPTED_TURN_GRACE);
    const currentStatuses = yield* SubscriptionRef.get(sessionStatuses);
    if (currentStatuses.get(sessionId) === "running") yield* settleSessionTurn(sessionId);
  },
  Effect.catchTag("SessionNotFoundError", () => Effect.void)
);

// For the window's whole life, each session's latest title restarts its wait to settle, so a busy title cancels it.
export const startInterruptedTurnSettle = Effect.fn("StatusService.startInterruptedTurnSettle")(function* () {
  const {sessionTerminalTitles} = yield* ITerminalInfraService;
  const pendingSettles = yield* FiberMap.make<EntityIdValueObject>();

  yield* Effect.forkScoped(
    Stream.runForEach(sessionTerminalTitles, ([sessionId, terminalTitle]) =>
      FiberMap.run(pendingSettles, sessionId, settleInterruptedTurn(sessionId, terminalTitle))
    )
  );
});

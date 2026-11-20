import {WatchSessionProcessesRequestDtoSchema} from "@dtos/sessionProcess.dto.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {SessionProcessService} from "@services/sessionProcess.service.ts";
import {Context, Effect, Layer, Stream} from "effect";

export class SessionProcessController extends Context.Service<SessionProcessController>()(
  "aggregor-app/presentation/controllers/sessionProcess.controller/SessionProcessController",
  {
    make: Effect.fn("make")(function* () {
      const sessionProcessService = yield* SessionProcessService;
      const vscodeUtils = yield* VscodeUtils;

      // A list that isn't one of session ids stops the readings, as closing every dropdown does.
      const watchSessionProcessesForSessionsView = Effect.fn("watchSessionProcessesForSessionsView")(function* (
        openDropdownSessionIds: Stream.Stream<readonly string[]>
      ) {
        const watchRequests = Stream.mapEffect(openDropdownSessionIds, (sessionIds) =>
          Effect.orElseSucceed(
            vscodeUtils.decodeVsCodeArgument(WatchSessionProcessesRequestDtoSchema, {sessionIds}),
            () => WatchSessionProcessesRequestDtoSchema.make({sessionIds: []})
          )
        );

        return yield* sessionProcessService.watchSessionProcesses(watchRequests);
      });

      return {watchSessionProcessesForSessionsView};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("SessionProcessController", this.make()));
}

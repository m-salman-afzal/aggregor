import {WatchSessionProcessesRequestDtoSchema} from "@dtos/sessionProcess.dto.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {SessionProcessService} from "@services/sessionProcess.service.ts";
import {Context, Effect, Layer, Stream} from "effect";

export class SessionProcessController extends Context.Service<SessionProcessController>()(
  "aggregor-app/presentation/controllers/sessionProcess.controller/SessionProcessController",
  {
    make: Effect.fn("SessionProcessController.make")(function* () {
      const sessionProcessService = yield* SessionProcessService;
      const vscodeUtils = yield* VscodeUtils;

      const watchSessionProcessesForSessionsView = Effect.fn(
        "SessionProcessController.watchSessionProcessesForSessionsView"
      )(function* (openDropdownSessionIds: Stream.Stream<readonly string[]>) {
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
  public static readonly layer = Layer.effect(this, this.make());
}

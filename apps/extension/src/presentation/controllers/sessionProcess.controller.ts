import {WatchSessionProcessesRequestDtoSchema} from "@dtos/sessionProcess.dto.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {watchSessionProcesses} from "@services/sessionProcess.service.ts";
import {Effect, Stream} from "effect";

// A list that isn't one of session ids stops the readings, as closing every dropdown does.
export const watchSessionProcessesForSessionsView = Effect.fn(
  "SessionProcessController.watchSessionProcessesForSessionsView"
)(function* (openDropdownSessionIds: Stream.Stream<readonly string[]>) {
  const watchRequests = Stream.mapEffect(openDropdownSessionIds, (sessionIds) =>
    Effect.orElseSucceed(decodeVsCodeArgument(WatchSessionProcessesRequestDtoSchema, {sessionIds}), () =>
      WatchSessionProcessesRequestDtoSchema.make({sessionIds: []})
    )
  );

  return yield* watchSessionProcesses(watchRequests);
});

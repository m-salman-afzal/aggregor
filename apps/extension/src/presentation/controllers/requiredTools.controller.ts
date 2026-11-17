import {installRequiredTools, watchMissingTools} from "@services/requiredTools.service.ts";
import {Effect} from "effect";

export const installRequiredToolsFromNotice = Effect.fn("RequiredToolsController.installRequiredToolsFromNotice")(
  function* () {
    yield* installRequiredTools();
  }
);

export const watchMissingToolsForRequiredToolsNoticesView = Effect.fn(
  "RequiredToolsController.watchMissingToolsForRequiredToolsNoticesView"
)(function* () {
  return yield* watchMissingTools();
});

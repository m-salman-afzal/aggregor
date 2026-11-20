import {REQUIRED_TOOLS_ERRORS} from "@pkg/constants/src/requiredTools.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Context, Effect, Layer, Match} from "effect";

import type {RequiredToolsService} from "@services/requiredTools.service.ts";

type RequiredToolsCommandError = Effect.Error<RequiredToolsService["Service"]["installRequiredTools"]>;

export class RequiredToolsErrorMessage extends Context.Service<RequiredToolsErrorMessage>()(
  "aggregor-app/presentation/errorMessages/requiredTools.errorMessage/RequiredToolsErrorMessage",
  {
    make: Effect.fn("make")(function* () {
      const getRequiredToolsCommandErrorMessage = Effect.fn("getRequiredToolsCommandErrorMessage")(function* (
        requiredToolsCommandError: RequiredToolsCommandError
      ) {
        return Match.valueTags(requiredToolsCommandError, {
          NoPackageManagerError: () => ({message: REQUIRED_TOOLS_ERRORS.NO_PACKAGE_MANAGER})
        });
      });

      return {getRequiredToolsCommandErrorMessage};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("RequiredToolsErrorMessage", this.make()));
}

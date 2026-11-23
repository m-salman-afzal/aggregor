import {Context, Effect, Layer, Match} from "effect";

import {REQUIRED_TOOLS_ERRORS} from "@pkg/constants/src/requiredTools.constant.ts";

import type {RequiredToolsService} from "@/services/requiredTools.service.ts";

type RequiredToolsCommandError = Effect.Error<RequiredToolsService["Service"]["installRequiredTools"]>;

export class RequiredToolsErrorMessage extends Context.Service<RequiredToolsErrorMessage>()(
  "aggregor-app/presentation/errorMessages/requiredTools.errorMessage/RequiredToolsErrorMessage",
  {
    make: Effect.fn("RequiredToolsErrorMessage.make")(function* () {
      const getRequiredToolsCommandErrorMessage = Effect.fn(
        "RequiredToolsErrorMessage.getRequiredToolsCommandErrorMessage"
      )(function* (requiredToolsCommandError: RequiredToolsCommandError) {
        return Match.valueTags(requiredToolsCommandError, {
          NoPackageManagerError: () => ({message: REQUIRED_TOOLS_ERRORS.NO_PACKAGE_MANAGER})
        });
      });

      return {getRequiredToolsCommandErrorMessage};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}

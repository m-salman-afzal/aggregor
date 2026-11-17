import {REQUIRED_TOOLS_ERRORS} from "@pkg/constants/src/requiredTools.constant.ts";
import {Effect, Match} from "effect";

import type {installRequiredTools} from "@services/requiredTools.service.ts";

type RequiredToolsCommandError = Effect.Error<ReturnType<typeof installRequiredTools>>;

export const presentRequiredToolsCommandError = Effect.fn("RequiredToolsPresenter.presentRequiredToolsCommandError")(
  function* (requiredToolsCommandError: RequiredToolsCommandError) {
    return Match.valueTags(requiredToolsCommandError, {
      NoPackageManagerError: () => ({message: REQUIRED_TOOLS_ERRORS.NO_PACKAGE_MANAGER})
    });
  }
);

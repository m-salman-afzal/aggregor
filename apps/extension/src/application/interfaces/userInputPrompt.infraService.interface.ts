import {Context} from "effect";

import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";

import type {Effect} from "effect";

import type {ProjectPathValueObject} from "@/valueObjects/projectPath.valueObject.ts";

export class IUserInputPromptInfraServiceErrors extends TaggedErrors({
  FolderPickCancelledError: {}
}) {}

export class IUserInputPromptInfraService extends Context.Service<
  IUserInputPromptInfraService,
  {
    readonly pickProjectFolderPaths: Effect.Effect<
      readonly ProjectPathValueObject[],
      IUserInputPromptInfraServiceErrors["FolderPickCancelledError"]
    >;
  }
>()("aggregor-app/application/interfaces/userInputPrompt.infraService.interface/IUserInputPromptInfraService") {}

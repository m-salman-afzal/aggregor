import {Context, Schema} from "effect";

import type {ProjectEntity} from "@entities/project/project.entity.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect} from "effect";

export class FolderPickCancelledError extends Schema.TaggedError<
  FolderPickCancelledError,
  {readonly brand: unique symbol}
>()("FolderPickCancelledError", {}) {}
export class ProjectPickCancelledError extends Schema.TaggedError<
  ProjectPickCancelledError,
  {readonly brand: unique symbol}
>()("ProjectPickCancelledError", {}) {}

// What the extension asks the user, and the errors it shows them.
export class IPromptInfraService extends Context.Service<
  IPromptInfraService,
  {
    // A modal warning; true when the user picks `confirmAction`.
    readonly confirm: (message: string, confirmAction: string) => Effect.Effect<boolean>;
    readonly pickProject: (
      projects: readonly ProjectEntity[],
      placeHolder: string
    ) => Effect.Effect<ProjectEntity, ProjectPickCancelledError>;
    readonly pickProjectFolderPaths: Effect.Effect<readonly ProjectPathValueObject[], FolderPickCancelledError>;
    // Resolves with the action the user picked, or undefined when they dismiss the message.
    readonly showErrorMessage: (message: string, ...actions: string[]) => Effect.Effect<string | undefined>;
  }
>()("aggregor-app/application/interfaces/prompt.infraService.interface/IPromptInfraService") {}

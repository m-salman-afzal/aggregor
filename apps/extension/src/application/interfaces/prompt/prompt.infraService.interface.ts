import {Context} from "effect";

import type {
  FolderPickCancelledError,
  ProjectPickCancelledError
} from "@/application/interfaces/prompt/prompt.infraService.error.ts";
import type {ProjectEntity} from "@/domain/entities/project/project.entity.ts";
import type {ProjectPathValueObject} from "@/domain/valueObjects/projectPath.valueObject.ts";
import type {Effect} from "effect";

// What the extension asks the user, and the errors it shows them.
export class IPromptInfraService extends Context.Service<
  IPromptInfraService,
  {
    // A modal warning; true when the user picks `confirmAction`.
    readonly confirm: (message: string, confirmAction: string) => Effect.Effect<boolean>;
    readonly pickProject: (
      projects: readonly ProjectEntity[]
    ) => Effect.Effect<ProjectEntity, ProjectPickCancelledError>;
    readonly pickProjectFolderPaths: () => Effect.Effect<readonly ProjectPathValueObject[], FolderPickCancelledError>;
    // Resolves with the action the user picked, or undefined when they dismiss the message.
    readonly showErrorMessage: (message: string, ...actions: string[]) => Effect.Effect<string | undefined>;
  }
>()("aggregor/application/interfaces/prompt/prompt.infraService.interface/IPromptInfraService") {}

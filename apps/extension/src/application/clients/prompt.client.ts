import {Context} from "effect";

import type {FolderPickCancelled, ProjectPickCancelled} from "@/application/errors/project.error.ts";
import type {Project} from "@/domain/entities/project/project.entity.ts";
import type {ProjectPath} from "@/domain/value-objects/project-path.value-object.ts";
import type {Effect} from "effect";

// What the extension asks the user, and the errors it shows them.
export class PromptClient extends Context.Service<
  PromptClient,
  {
    // A modal warning; true when the user picks `confirmAction`.
    readonly confirm: (message: string, confirmAction: string) => Effect.Effect<boolean>;
    readonly pickProject: (projects: readonly Project[]) => Effect.Effect<Project, ProjectPickCancelled>;
    readonly pickProjectFolderPaths: () => Effect.Effect<readonly ProjectPath[], FolderPickCancelled>;
    // Resolves with the action the user picked, or undefined when they dismiss the message.
    readonly showErrorMessage: (message: string, ...actions: string[]) => Effect.Effect<string | undefined>;
  }
>()("aggregor/application/clients/prompt.client/PromptClient") {}

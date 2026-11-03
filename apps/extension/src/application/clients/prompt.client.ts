import {Context} from "effect";

import type {FolderPickCancelled, RepoPickCancelled} from "@/application/errors/repo.error.ts";
import type {Repo} from "@/domain/entities/repo/repo.entity.ts";
import type {RepoPath} from "@/domain/value-objects/repo-path.value-object.ts";
import type {Effect} from "effect";

// What the extension asks the user, and the errors it shows them.
export class PromptClient extends Context.Service<
  PromptClient,
  {
    // A modal warning; true when the user picks `confirmAction`.
    readonly confirm: (message: string, confirmAction: string) => Effect.Effect<boolean>;
    readonly pickRepo: (repos: readonly Repo[]) => Effect.Effect<Repo, RepoPickCancelled>;
    readonly pickRepoFolderPaths: () => Effect.Effect<readonly RepoPath[], FolderPickCancelled>;
    // Resolves with the action the user picked, or undefined when they dismiss the message.
    readonly showErrorMessage: (message: string, ...actions: string[]) => Effect.Effect<string | undefined>;
  }
>()("aggregor/application/clients/prompt.client/PromptClient") {}

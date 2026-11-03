import {Context} from "effect";

import type {ReposCorrupt, ReposSaveFailed} from "@/domain/errors/repo.error.ts";
import type {RepoPath} from "@/domain/value-objects/repo-path.value-object.ts";
import type {Effect, SubscriptionRef} from "effect";

// The paths added with Add Repo, saved per workspace. Workspace folders are not saved: VS Code already lists them.
export class RepoRepository extends Context.Service<
  RepoRepository,
  {
    readonly addedRepoPaths: SubscriptionRef.SubscriptionRef<readonly RepoPath[]>;
    // Re-reads the saved paths, applies the change and saves the result: unreadable data fails the change instead of
    // being overwritten.
    readonly modifyAddedRepoPaths: (
      changeAddedRepoPaths: (savedAddedRepoPaths: readonly RepoPath[]) => readonly RepoPath[]
    ) => Effect.Effect<void, ReposCorrupt | ReposSaveFailed>;
  }
>()("aggregor/domain/entities/repo/repo.repository/RepoRepository") {}

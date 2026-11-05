import {Context} from "effect";

import type {ProjectsCorrupt, ProjectsSaveFailed} from "@/domain/errors/project.error.ts";
import type {ProjectPath} from "@/domain/value-objects/project-path.value-object.ts";
import type {Effect, SubscriptionRef} from "effect";

// The paths added with Add Project, saved per workspace. Workspace folders are not saved: VS Code already lists them.
export class ProjectRepository extends Context.Service<
  ProjectRepository,
  {
    readonly addedProjectPaths: SubscriptionRef.SubscriptionRef<readonly ProjectPath[]>;
    // Re-reads the saved paths, applies the change and saves the result: unreadable data fails the change instead of
    // being overwritten.
    readonly modifyAddedProjectPaths: (
      changeAddedProjectPaths: (savedAddedProjectPaths: readonly ProjectPath[]) => readonly ProjectPath[]
    ) => Effect.Effect<void, ProjectsCorrupt | ProjectsSaveFailed>;
  }
>()("aggregor/domain/entities/project/project.repository/ProjectRepository") {}

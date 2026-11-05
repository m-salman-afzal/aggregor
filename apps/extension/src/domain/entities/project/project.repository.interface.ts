import {Context, Data} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect, SubscriptionRef} from "effect";

export class ProjectsCorruptError extends Data.TaggedError("ProjectsCorruptError")<{readonly cause: unknown}> {}
export class ProjectsSaveFailedError extends Data.TaggedError("ProjectsSaveFailedError")<{readonly cause: unknown}> {}

// The paths added with Add Project, saved per workspace. Workspace folders are not saved: VS Code already lists them.
export class IProjectRepository extends Context.Service<
  IProjectRepository,
  {
    readonly addedProjectPaths: SubscriptionRef.SubscriptionRef<readonly ProjectPathValueObject[]>;
    // Re-reads the saved paths, applies the change and saves the result: unreadable data fails the change instead of
    // being overwritten.
    readonly modifyAddedProjectPaths: (
      changeAddedProjectPaths: (
        savedAddedProjectPaths: readonly ProjectPathValueObject[]
      ) => readonly ProjectPathValueObject[]
    ) => Effect.Effect<void, ProjectsCorruptError | ProjectsSaveFailedError>;
  }
>()("aggregor/domain/entities/project/project.repository.interface/IProjectRepository") {}

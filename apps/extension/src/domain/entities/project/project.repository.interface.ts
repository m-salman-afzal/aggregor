import {Context, Schema} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect, SubscriptionRef} from "effect";

export class ProjectsCorruptError extends Schema.TaggedError<ProjectsCorruptError, {readonly brand: unique symbol}>()(
  "ProjectsCorruptError",
  {cause: Schema.Unknown}
) {}
export class ProjectsSaveFailedError extends Schema.TaggedError<
  ProjectsSaveFailedError,
  {readonly brand: unique symbol}
>()("ProjectsSaveFailedError", {cause: Schema.Unknown}) {}

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
>()("aggregor-app/domain/entities/project/project.repository.interface/IProjectRepository") {}

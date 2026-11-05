import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Schema} from "effect";

// The paths added with Add Project, as workspaceState keeps them. Any change to this shape bumps `version`, so older code
// fails to decode it instead of writing back a stripped copy.
export const StoredAddedProjectPathsModel = Schema.Struct({
  addedProjectPaths: Schema.Array(ProjectPathValueObjectSchema),
  version: Schema.Literal(1)
});

export const NO_ADDED_PROJECT_PATHS: typeof StoredAddedProjectPathsModel.Encoded = {addedProjectPaths: [], version: 1};

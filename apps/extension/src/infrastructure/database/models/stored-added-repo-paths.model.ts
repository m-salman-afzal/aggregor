import {RepoPathSchema} from "@/domain/value-objects/repo-path.value-object.ts";
import {Schema} from "effect";

// The paths added with Add Repo, as workspaceState keeps them. Any change to this shape bumps `version`, so older code
// fails to decode it instead of writing back a stripped copy.
export const StoredAddedRepoPaths = Schema.Struct({
  addedRepoPaths: Schema.Array(RepoPathSchema),
  version: Schema.Literal(1)
});

export const NO_ADDED_REPO_PATHS: typeof StoredAddedRepoPaths.Encoded = {addedRepoPaths: [], version: 1};

import {Schema} from "effect";

// The absolute path of a repo's folder on disk.
export const RepoPathSchema = Schema.String.pipe(Schema.brand("RepoPath"));

export type RepoPath = typeof RepoPathSchema.Type;

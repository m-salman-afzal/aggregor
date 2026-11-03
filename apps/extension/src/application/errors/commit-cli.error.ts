// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

export class CommitCliError extends Data.TaggedError("CommitCliError")<{
  readonly exitCode: number;
  readonly stderr: string;
}> {}
// The command could not be started, or its output could not be read.
export class CommitCliSpawnFailed extends Data.TaggedError("CommitCliSpawnFailed")<{readonly reason: string}> {}
export class EmptyCommitMessage extends Data.TaggedError("EmptyCommitMessage") {}

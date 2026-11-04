// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

export class CommitCliError extends Data.TaggedError("CommitCliError")<{
  readonly exitCode: number;
  readonly stderr: string;
}> {}
// The command could not be started, or its output could not be read.
export class CommitCliSpawnFailedError extends Data.TaggedError("CommitCliSpawnFailedError")<{
  readonly reason: string;
}> {}
export class EmptyCommitMessageError extends Data.TaggedError("EmptyCommitMessageError") {}

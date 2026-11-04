// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

export class FolderPickCancelledError extends Data.TaggedError("FolderPickCancelledError") {}
export class ProjectPickCancelledError extends Data.TaggedError("ProjectPickCancelledError") {}

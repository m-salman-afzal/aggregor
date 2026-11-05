// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

export class FolderPickCancelled extends Data.TaggedError("FolderPickCancelled") {}
export class NoProject extends Data.TaggedError("NoProject") {}
export class ProjectPickCancelled extends Data.TaggedError("ProjectPickCancelled") {}

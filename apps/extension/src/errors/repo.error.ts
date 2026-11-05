// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

export class FolderPickCancelled extends Data.TaggedError("FolderPickCancelled") {}
export class NoRepo extends Data.TaggedError("NoRepo") {}
export class RepoPickCancelled extends Data.TaggedError("RepoPickCancelled") {}

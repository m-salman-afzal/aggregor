// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

export class FolderPickCancelled extends Data.TaggedError("FolderPickCancelled") {}
export class NoActiveTerminal extends Data.TaggedError("NoActiveTerminal") {}
export class NoWorkspaceFolder extends Data.TaggedError("NoWorkspaceFolder") {}
export class RevealFailed extends Data.TaggedError("RevealFailed")<{readonly cause: unknown}> {}
export class SessionNotFound extends Data.TaggedError("SessionNotFound")<{readonly id: string}> {}
export class TerminalLaunchFailed extends Data.TaggedError("TerminalLaunchFailed")<{readonly cause: unknown}> {}
export class TerminalNotFound extends Data.TaggedError("TerminalNotFound")<{readonly id: string}> {}
export class UntrackedTerminal extends Data.TaggedError("UntrackedTerminal") {}

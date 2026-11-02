// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

export class NoActiveTerminal extends Data.TaggedError("NoActiveTerminal") {}
export class RemoveCancelled extends Data.TaggedError("RemoveCancelled") {}
export class RevealFailed extends Data.TaggedError("RevealFailed")<{readonly cause: unknown}> {}
export class SessionNotFound extends Data.TaggedError("SessionNotFound")<{readonly sessionId: string}> {}
export class SessionsCorrupt extends Data.TaggedError("SessionsCorrupt")<{readonly cause: unknown}> {}
export class SessionsSaveFailed extends Data.TaggedError("SessionsSaveFailed")<{readonly cause: unknown}> {}
export class TerminalLaunchFailed extends Data.TaggedError("TerminalLaunchFailed")<{readonly cause: unknown}> {}
export class TerminalNotFound extends Data.TaggedError("TerminalNotFound")<{readonly sessionId: string}> {}
export class TranscriptNotFound extends Data.TaggedError("TranscriptNotFound")<{readonly sessionId: string}> {}
export class UntrackedTerminal extends Data.TaggedError("UntrackedTerminal") {}

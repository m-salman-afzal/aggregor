// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

// Why TerminalInfraService can't name the session in view. The interface only sees NoViewedSessionError.
export class NoActiveTerminalError extends Data.TaggedError("NoActiveTerminalError") {}
export class NotATerminalTabError extends Data.TaggedError("NotATerminalTabError") {}
export class UntrackedTerminalError extends Data.TaggedError("UntrackedTerminalError") {}
export class WindowUnfocusedError extends Data.TaggedError("WindowUnfocusedError") {}

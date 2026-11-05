// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

import type {SessionIdValueObject} from "@/domain/valueObjects/sessionId.valueObject.ts";

// Why no session is in front of the user.
export type NoViewedSessionError =
  NoActiveTerminalError | NotATerminalTabError | UntrackedTerminalError | WindowUnfocusedError;

export class NoActiveTerminalError extends Data.TaggedError("NoActiveTerminalError") {}
export class NotATerminalTabError extends Data.TaggedError("NotATerminalTabError") {}
export class TerminalLaunchFailedError extends Data.TaggedError("TerminalLaunchFailedError")<{
  readonly cause: unknown;
}> {}
export class TerminalNotFoundError extends Data.TaggedError("TerminalNotFoundError")<{
  readonly sessionId: SessionIdValueObject;
}> {}
export class UntrackedTerminalError extends Data.TaggedError("UntrackedTerminalError") {}
export class WindowUnfocusedError extends Data.TaggedError("WindowUnfocusedError") {}

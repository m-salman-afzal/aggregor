// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

import type {SessionIdValueObject} from "@/domain/valueObjects/sessionId.valueObject.ts";

// No session's tab is in front of the user; TerminalInfraService's trace says why.
export class NoViewedSessionError extends Data.TaggedError("NoViewedSessionError") {}
export class TerminalLaunchFailedError extends Data.TaggedError("TerminalLaunchFailedError")<{
  readonly cause: unknown;
}> {}
export class TerminalNotFoundError extends Data.TaggedError("TerminalNotFoundError")<{
  readonly sessionId: SessionIdValueObject;
}> {}

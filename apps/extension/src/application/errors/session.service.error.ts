// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

import type {SessionIdValueObject} from "@/domain/valueObjects/sessionId.valueObject.ts";

export class RemoveCancelledError extends Data.TaggedError("RemoveCancelledError") {}
export class SessionNotFoundError extends Data.TaggedError("SessionNotFoundError")<{
  readonly sessionId: SessionIdValueObject;
}> {}

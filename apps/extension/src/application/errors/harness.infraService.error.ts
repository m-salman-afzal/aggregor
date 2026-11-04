import {Data} from "effect";

import type {SessionIdValueObject} from "@/domain/valueObjects/sessionId.valueObject.ts";

export class SessionTitleNotFoundError extends Data.TaggedError("SessionTitleNotFoundError")<{
  readonly sessionId: SessionIdValueObject;
}> {}

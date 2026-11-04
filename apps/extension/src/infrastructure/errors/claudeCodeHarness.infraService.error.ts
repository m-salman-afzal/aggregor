// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

import type {SessionIdValueObject} from "@/domain/valueObjects/sessionId.valueObject.ts";

export class TitleNotFoundError extends Data.TaggedError("TitleNotFoundError") {}
export class TranscriptNotFoundError extends Data.TaggedError("TranscriptNotFoundError")<{
  readonly sessionId: SessionIdValueObject;
}> {}

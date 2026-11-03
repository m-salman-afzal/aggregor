// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

import type {SessionId} from "@/domain/value-objects/session-id.value-object.ts";

export class RevealFailed extends Data.TaggedError("RevealFailed")<{readonly cause: unknown}> {}
export class SessionTitleNotFound extends Data.TaggedError("SessionTitleNotFound")<{readonly sessionId: SessionId}> {}
export class TranscriptNotFound extends Data.TaggedError("TranscriptNotFound")<{readonly sessionId: SessionId}> {}

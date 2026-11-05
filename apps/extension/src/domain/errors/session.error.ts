// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

import type {SessionId} from "@/domain/value-objects/session-id.value-object.ts";

export class SessionNotFound extends Data.TaggedError("SessionNotFound")<{readonly sessionId: SessionId}> {}
export class SessionsCorrupt extends Data.TaggedError("SessionsCorrupt")<{readonly cause: unknown}> {}
export class SessionsSaveFailed extends Data.TaggedError("SessionsSaveFailed")<{readonly cause: unknown}> {}
export class TitleNotFound extends Data.TaggedError("TitleNotFound") {}

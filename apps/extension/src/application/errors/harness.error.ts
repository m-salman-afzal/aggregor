import {Data} from "effect";

import type {SessionId} from "@/domain/value-objects/session-id.value-object.ts";

export class SessionTitleNotFound extends Data.TaggedError("SessionTitleNotFound")<{readonly sessionId: SessionId}> {}

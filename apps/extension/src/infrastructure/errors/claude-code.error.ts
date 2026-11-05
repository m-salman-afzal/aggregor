import {Data} from "effect";

import type {SessionId} from "@/domain/value-objects/session-id.value-object.ts";

export class TranscriptNotFound extends Data.TaggedError("TranscriptNotFound")<{readonly sessionId: SessionId}> {}

import {Schema} from "effect";

// Our id for a session. Claude Code takes it as its own session id, and the session's status file is named after it.
export const SessionIdSchema = Schema.String.check(Schema.isUUID()).pipe(Schema.brand("SessionId"));

export type SessionId = typeof SessionIdSchema.Type;

// For ids that arrive as file names or URI paths; anything else is not one of ours.
export const decodeSessionId = Schema.decodeUnknownResult(SessionIdSchema);

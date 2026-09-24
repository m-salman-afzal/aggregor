export const SESSION_UPDATE_TYPES = {
  AGENT_MESSAGE_CHUNK: "agent_message_chunk",
  AGENT_THOUGHT_CHUNK: "agent_thought_chunk",
  PLAN: "plan",
  TOOL_CALL: "tool_call",
  TOOL_CALL_UPDATE: "tool_call_update",
  USER_MESSAGE_CHUNK: "user_message_chunk"
} as const;

export const SESSION_UPDATE_CONTENT_TYPES = {
  TEXT: "text"
} as const;

export const MESSAGE_KINDS = {
  SESSION_UPDATE: "session_update",
  STOP: "stop"
} as const;

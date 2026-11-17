// Two agents could share an id, so each key names its agent.
export const IMPORT_ROW_KEY = (agentId: string, agentSessionId: string) => `${agentId}:${agentSessionId}`;

export const IMPORT_DATE_FORMAT = {dateStyle: "medium", timeStyle: "short"} as const;

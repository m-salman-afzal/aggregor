export const SESSION_DROPDOWN_LABELS = {
  AGENT_TERMINAL: "Agent terminal",
  SHARED_SHELL: (sharingSessionCount: number) => `Shared by ${sharingSessionCount} sessions`
} as const;

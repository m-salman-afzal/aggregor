// The settings under aggregorApp that pick and define the agents.
export const AGENT_SETTINGS = {
  AGENTS: "agents",
  DEFAULT_AGENT: "defaultAgent",
  SKIP_AGENT_PICKER: "skipAgentPicker"
} as const;

// The image an agent entry without an icon of its own shows, inside the extension: Aggregor's logo.
export const DEFAULT_AGENT_ICON = "assets/agents/aggregor.svg";

export const AGENT_LABELS = {
  DEFAULT: "default",
  PICK: "Agent for the new session",
  SET_AS_DEFAULT: "Set as Default"
} as const;

export const AGENT_ERRORS = {
  NONE_INSTALLED: (searchedCommands: readonly string[]) =>
    `No agent CLI is installed: none of ${searchedCommands.join(", ")} is on PATH. Install one, or add yours to the agents setting.`,
  NOT_FOUND: (agentId: string) => `This session's agent, "${agentId}", is no longer in the agents setting.`
} as const;

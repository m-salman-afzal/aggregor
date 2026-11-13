import {SETTINGS_SECTION} from "@pkg/constants/src/app.constant.ts";

// The settings under aggregorApp that pick and define the agents.
export const AGENT_SETTINGS = {
  AGENTS: "agents",
  DEFAULT_AGENT: "defaultAgent",
  SKIP_AGENT_PICKER: "skipAgentPicker"
} as const;

// The agents setting's full id, which its changes and the Open Settings button of a failure it causes name.
export const AGENTS_SETTING_ID = `${SETTINGS_SECTION}.${AGENT_SETTINGS.AGENTS}`;

// An agent's icon is an SVG or PNG file, and an entry naming anything else is left out; an entry without one shows
// Aggregor's logo, inside the extension.
export const AGENT_ICON = {
  DEFAULT: "assets/agents/aggregor.svg",
  FILE_PATTERN: /\.(?:png|svg)$/iu
} as const;

// What the user did in the agent picker: picked an agent to start, or asked for one to become the default.
export const AGENT_PICK_TAGS = {
  AGENT_PICKED: "AgentPicked",
  DEFAULT_AGENT_CHOSEN: "DefaultAgentChosen"
} as const;

export const AGENT_LABELS = {
  DEFAULT: "default",
  PICK: "Agent for the new session",
  SET_AS_DEFAULT: "Set as Default"
} as const;

export const AGENT_ERRORS = {
  NONE_INSTALLED: (searchedCommandList: string) =>
    `No agent CLI is installed: none of ${searchedCommandList} is on PATH. Install one, or add yours to the agents setting.`,
  NOT_FOUND: (agentId: string) => `This session's agent, "${agentId}", is no longer in the agents setting.`
} as const;

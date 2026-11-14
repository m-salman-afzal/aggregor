import {SETTINGS_SECTION} from "@pkg/constants/src/app.constant.ts";

export const AGENT_SETTINGS = {
  AGENTS: "agents",
  DEFAULT_AGENT: "defaultAgent",
  SKIP_AGENT_PICKER: "skipAgentPicker"
} as const;

export const AGENTS_SETTING_ID = `${SETTINGS_SECTION}.${AGENT_SETTINGS.AGENTS}`;

export const AGENT_ICON = {
  DEFAULT: "assets/agents/aggregor.svg",
  FILE_PATTERN: /\.(?:png|svg)$/iu
} as const;

export const AGENT_COMMANDS = {
  SET_DEFAULT: "aggregorApp.setDefaultAgent"
} as const;

export const AGENT_LABELS = {
  DEFAULT: "default",
  SET_AS_DEFAULT: "Set as Default"
} as const;

export const AGENT_ERRORS = {
  NONE_INSTALLED: (searchedCommandList: string) =>
    `No agent CLI is installed: none of ${searchedCommandList} is on PATH. Install one, or add yours to the agents setting.`,
  NOT_FOUND: (agentId: string) => `This session's agent, "${agentId}", is no longer in the agents setting.`
} as const;

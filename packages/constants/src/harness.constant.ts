// The settings under aggregorApp that pick and define the agents.
export const HARNESS_SETTINGS = {
  DEFAULT_HARNESS: "defaultHarness",
  HARNESSES: "harnesses",
  SKIP_HARNESS_PICKER: "skipHarnessPicker"
} as const;

// The codicon a harness entry without an icon of its own shows.
export const DEFAULT_HARNESS_CODICON = "terminal";

export const HARNESS_LABELS = {
  DEFAULT: "default",
  PICK: "Agent for the new session",
  SET_AS_DEFAULT: "Set as Default"
} as const;

export const HARNESS_ERRORS = {
  NONE_INSTALLED: (searchedCommands: readonly string[]) =>
    `No agent CLI is installed: none of ${searchedCommands.join(", ")} is on PATH. Install one, or add yours to the harnesses setting.`,
  NOT_FOUND: (harnessId: string) => `This session's agent, "${harnessId}", is no longer in the harnesses setting.`
} as const;

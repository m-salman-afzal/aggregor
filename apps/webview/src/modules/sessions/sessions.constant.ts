// What the view says besides its sessions' own texts and the ones the extension shares.
export const SESSIONS_LABELS = {
  DETAIL_SEPARATOR: " · ",
  MISSING_AGENT: "Agent not in settings",
  NO_PROJECTS: "No projects yet.",
  PROGRESS: (statusProgress: number) => `${statusProgress}%`
} as const;

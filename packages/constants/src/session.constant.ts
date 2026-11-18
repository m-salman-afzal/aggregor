export const SESSION_COMMANDS = {
  ARCHIVE: "aggregorApp.archiveSession",
  ARCHIVE_ONGOING: "aggregorApp.archiveOngoingSessions",
  ARCHIVE_PROJECT_SESSIONS: "aggregorApp.archiveProjectSessions",
  CHANGE_WORKING_TREE: "aggregorApp.changeSessionWorkingTree",
  IMPORT: "aggregorApp.importSessions",
  MOVE_DOWN: "aggregorApp.moveSessionDown",
  MOVE_UP: "aggregorApp.moveSessionUp",
  NEW_IN_CHOSEN_PROJECT: "aggregorApp.newSessionInChosenProject",
  OPEN: "aggregorApp.openSession",
  REMOVE: "aggregorApp.removeSession",
  RENAME: "aggregorApp.renameSession",
  RENAME_BRANCH: "aggregorApp.renameSessionBranch",
  STOP_AGENT: "aggregorApp.stopSessionAgent",
  STOP_ARCHIVED_AGENTS: "aggregorApp.stopArchivedSessionAgents",
  STOP_ARCHIVED_PROJECT_AGENTS: "aggregorApp.stopArchivedProjectSessionAgents",
  STOP_ONGOING_AGENTS: "aggregorApp.stopOngoingSessionAgents",
  STOP_PROJECT_AGENTS: "aggregorApp.stopProjectSessionAgents",
  UNARCHIVE: "aggregorApp.unarchiveSession",
  UNLINK_WORKTREE: "aggregorApp.unlinkSessionWorktree"
} as const;

// Each project's list shows its newest sessions a page at a time.
export const SESSION_PAGES = {
  FIRST_PAGE_COUNT: 1,
  PAGE_SIZE: 10
} as const;

// An agent that stopped keeps its running mark this long, so one stopped by a shutdown, which ends VS Code too, keeps it.
export const SESSION_RUN_STATE = {
  STOP_SETTLE_INTERVAL: "10 seconds"
} as const;

// What a request to start or move a session says about the working tree it runs in.
export const WORKING_TREE_CHOICE_TAGS = {
  EXISTING_WORKTREE: "ExistingWorktree",
  NEW_WORKTREE: "NewWorktree",
  PROJECT_ROOT: "ProjectRoot"
} as const;

export const SESSION_LABELS = {
  AGENT_SECTION: "Agent",
  BASE_BRANCH_SECTION: "From",
  CHANGE_WORKING_TREE: (displayName: string) => `Move "${displayName}"`,
  CONFIRM_REMOVE: "Remove",
  CURRENT: "Current",
  CURRENT_COMMIT: "Current commit",
  FETCHING_REMOTE_BRANCHES: "Fetching origin's branches",
  LOCAL_BRANCHES_TAB: "Local",
  MOVE: "Move",
  NEW_SESSION: "New session",
  NEW_WORKTREE: "New worktree",
  NEW_WORKTREE_DESCRIPTION: "A branch of its own",
  NO_MATCHES: "No matches",
  PROJECT_ROOT: "Project root",
  PROJECT_SECTION: "Project",
  REMOTE_BRANCHES_TAB: "Remote",
  RENAME: "Session name. Leave it empty to show the agent's own title again.",
  RENAME_BRANCH: "Branch name",
  RESTART_AGENT: "Restart Agent",
  SEARCH: "Search…",
  START: "Start",
  STOP_AGENT: "Stop Agent",
  STOP_AGENTS: "Stop Agents",
  WORKING_TREE_SECTION: "Works in"
} as const;

// Which one a question shows is picked in the webview's sessions.utils.ts.
export const SESSION_NOTICES = {
  CONFIRM_REMOVE_RUNNING: (displayName: string) => `Remove "${displayName}"?`,
  CONFIRM_RESTART_AGENT: (displayName: string) => `Restart the agent of "${displayName}" in another folder?`,
  CONFIRM_STOP_AGENT: (displayName: string) => `Stop the agent of "${displayName}"?`,
  CONFIRM_STOP_AGENTS: (runningAgentCount: number) => `Stop ${runningAgentCount} running agents?`,
  REMOVE_STOPPING_AGENT: "Its agent is still running and will be stopped.",
  RESTART_AGENT_MID_TURN_CONSEQUENCE: "Its turn is cut short, and its conversation resumes in the new folder.",
  STOP_AGENT_MID_TURN_CONSEQUENCE: "Its turn is cut short. Opening the session starts its agent again.",
  STOP_AGENTS_MID_TURN_CONSEQUENCE: (turnRunningCount: number) =>
    `${turnRunningCount} of them are in the middle of a turn, which is cut short. Opening a session starts its agent again.`
} as const;

// systemd's sizes: bytes with an optional K, M, G or T, or a share of the machine's memory; empty sets no limit.
export const SESSION_SETTINGS = {
  MEMORY_LIMIT_PATTERN: /^(?:[1-9]\d*(?:\.\d+)?[KMGT]?|(?:100|[1-9]\d?)%)?$/u
} as const;

export const SESSION_ERRORS = {
  AGENT_SESSION_ID_NOT_FOUND: (agentName: string) =>
    `${agentName} never showed its conversation's id, so this session can't be resumed.`,
  INVALID_SETTINGS: (reason: string) => `The agent settings are invalid: ${reason}`,
  LAUNCH_FAILED: "Could not open a terminal for the session.",
  NOT_FOUND: "This session no longer exists.",
  PTY_BINARY_NOT_FOUND: "Sessions can't run on this platform yet: this build of Aggregor has no aggregor-pty for it.",
  // A Windows VSIX has no aggregor-pty; sessions on Windows run inside WSL, on the Linux VSIX.
  PTY_BINARY_NOT_FOUND_ON_WINDOWS: "On Windows, sessions run in WSL. Reopen the folder in WSL to start one."
} as const;

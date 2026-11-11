export const SESSION_COMMANDS = {
  ARCHIVE: "aggregorApp.archiveSession",
  ARCHIVE_ONGOING: "aggregorApp.archiveOngoingSessions",
  ARCHIVE_PROJECT_SESSIONS: "aggregorApp.archiveProjectSessions",
  MOVE_DOWN: "aggregorApp.moveSessionDown",
  MOVE_UP: "aggregorApp.moveSessionUp",
  NEW_ASKING_FOR_PROJECT: "aggregorApp.newSessionAskingForProject",
  NEW_IN_CHOSEN_PROJECT: "aggregorApp.newSessionInChosenProject",
  OPEN: "aggregorApp.openSession",
  REMOVE: "aggregorApp.removeSession",
  RENAME: "aggregorApp.renameSession",
  STOP_AGENT: "aggregorApp.stopSessionAgent",
  STOP_ARCHIVED_AGENTS: "aggregorApp.stopArchivedSessionAgents",
  STOP_ARCHIVED_PROJECT_AGENTS: "aggregorApp.stopArchivedProjectSessionAgents",
  STOP_ONGOING_AGENTS: "aggregorApp.stopOngoingSessionAgents",
  STOP_PROJECT_AGENTS: "aggregorApp.stopProjectSessionAgents",
  UNARCHIVE: "aggregorApp.unarchiveSession"
} as const;

export const SESSION_LABELS = {
  ARCHIVE_SESSIONS: "Archive Sessions",
  CONFIRM_REMOVE: "Remove",
  KEEP_AGENT_RUNNING: "Keep Agent Running",
  KEEP_AGENTS_RUNNING: "Keep Agents Running",
  PICK_PROJECT: "Project for the new session",
  RENAME: "Session name. Leave it empty to show the agent's own title again.",
  STOP_AGENT: "Stop Agent",
  STOP_AGENTS: "Stop Agents"
} as const;

// The questions a session command asks, and the line under each answer on what picking it does. Which one a command
// shows is picked in application/utils/sessionQuestion.utils.ts.
export const SESSION_NOTICES = {
  ARCHIVE_KEEPING_AGENT: "Its agent stays in the background; open the session from the Archive to use it.",
  ARCHIVE_KEEPING_AGENT_MID_TURN:
    "Its agent finishes its turn in the background; open the session from the Archive to see it.",
  ARCHIVE_KEEPING_AGENTS: "Their agents stay in the background; open a session from the Archive to use it.",
  ARCHIVE_KEEPING_AGENTS_MID_TURN: (turnRunningCount: number) =>
    `${turnRunningCount} of them finish their turn in the background; open a session from the Archive to see it.`,
  ARCHIVE_SESSIONS_CONSEQUENCE: "Each opens from the Archive as before; Unarchive in its menu moves it back.",
  ASK_ARCHIVE_SESSIONS: (sessionCount: number) => `Archive ${sessionCount} sessions?`,
  ASK_ARCHIVE_SESSIONS_WITH_AGENT_RUNNING: (sessionCount: number) =>
    `Archive ${sessionCount} sessions: keep the agent running in one of them?`,
  ASK_ARCHIVE_SESSIONS_WITH_AGENTS_RUNNING: (sessionCount: number, runningAgentCount: number) =>
    `Archive ${sessionCount} sessions: keep the agents running in ${runningAgentCount} of them?`,
  ASK_ARCHIVE_WITH_AGENT_RUNNING: (displayName: string) => `Archive "${displayName}": keep its agent running?`,
  CONFIRM_REMOVE_RUNNING: (displayName: string) => `Remove "${displayName}"?`,
  CONFIRM_STOP_AGENT: (displayName: string) => `Stop the agent of "${displayName}"?`,
  CONFIRM_STOP_AGENTS: (runningAgentCount: number) => `Stop ${runningAgentCount} running agents?`,
  REMOVE_STOPPING_AGENT: "Its agent is still running and will be stopped.",
  STOP_AGENT_CONSEQUENCE: "Opening the session starts its agent again.",
  STOP_AGENT_MID_TURN_CONSEQUENCE: "Its turn is cut short. Opening the session starts its agent again.",
  STOP_AGENTS_CONSEQUENCE: "Opening a session starts its agent again.",
  STOP_AGENTS_MID_TURN_CONSEQUENCE: (turnRunningCount: number) =>
    `${turnRunningCount} of them are in the middle of a turn, which is cut short. Opening a session starts its agent again.`
} as const;

export const SESSION_ERRORS = {
  AGENT_SESSION_ID_NOT_FOUND: (agentName: string) =>
    `${agentName} never showed its conversation's id, so this session can't be resumed.`,
  INVALID_SETTINGS: (reason: string) => `The agent settings are invalid: ${reason}`,
  LAUNCH_FAILED: "Could not open a terminal for the session.",
  NOT_FOUND: "This session no longer exists.",
  PROJECT_REQUIRED: "Add a project or open a folder to start a session.",
  PTY_BINARY_NOT_FOUND: "Sessions can't run on this platform yet: this build of Aggregor has no aggregor-pty for it.",
  // A Windows VSIX has no aggregor-pty; sessions on Windows run inside WSL, on the Linux VSIX.
  PTY_BINARY_NOT_FOUND_ON_WINDOWS: "On Windows, sessions run in WSL. Reopen the folder in WSL to start one."
} as const;

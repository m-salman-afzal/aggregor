import {AGENT_COMMANDS} from "@pkg/constants/src/agent.constant.ts";
import {APP_COMMANDS} from "@pkg/constants/src/app.constant.ts";
import {COMMIT_MESSAGE_COMMANDS} from "@pkg/constants/src/commitMessage.constant.ts";
import {WORKTREE_COMMANDS} from "@pkg/constants/src/git.constant.ts";
import {GITHUB_CLI_COMMANDS} from "@pkg/constants/src/gitHubCli.constant.ts";
import {PROJECT_COMMANDS} from "@pkg/constants/src/project.constant.ts";
import {REQUIRED_TOOLS_COMMANDS} from "@pkg/constants/src/requiredTools.constant.ts";
import {REVIEW_COMMENT_COMMANDS} from "@pkg/constants/src/reviewComment.constant.ts";
import {SESSION_COMMANDS, WORKING_TREE_CHOICE_TAGS} from "@pkg/constants/src/session.constant.ts";
import {SETTINGS_COMMANDS} from "@pkg/constants/src/settings.constant.ts";
import {TERMINAL_COMMANDS} from "@pkg/constants/src/terminal.constant.ts";

export const AGENT_API = {
  // The read routes' bad input: a query that doesn't decode, or a value its controller's request DTO rejects.
  INVALID_ARGUMENT_ERROR_TAGS: ["InvalidVsCodeArgumentError", "SchemaError"],
  // Set in every agent's and folder shell's tmux session, so an agent of the F5 build reaches its own socket.
  SOCKET_ENVIRONMENT_VARIABLE: "AGGREGOR_API_SOCKET",
  SOCKET_FILE_MODE: 0o600,
  SOCKET_FILE_NAME: "api.sock"
} as const;

export const AGENT_API_ROUTES = {
  AGENTS: "/agents",
  ARCHIVE: "/archive",
  COMMAND: "/commands/:commandId",
  COMMANDS: "/commands",
  PROJECT_BRANCHES: "/projects/branches",
  PROJECT_IMPORTABLE_SESSIONS: "/projects/importable-sessions",
  PROJECT_LEFTOVERS: "/projects/leftovers",
  PROJECT_SESSIONS: "/projects/sessions",
  PROJECTS: "/projects",
  REVIEW_COMMENTS: "/review-comments",
  SESSION_PROCESSES: "/sessions/processes",
  SESSION_PULL_REQUESTS: "/sessions/pull-requests",
  SETTINGS: "/settings"
} as const;

export const AGENT_API_STATUSES = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  UNPROCESSABLE_CONTENT: 422
} as const;

export const AGENT_API_ERRORS = {
  COMMAND_FAILED: "CommandFailed",
  COMMAND_NOT_FOUND: "CommandNotFound",
  INVALID_ARGUMENTS: "InvalidArguments",
  NO_SUCH_COMMAND: (commandId: string) => `No command ${commandId} is registered.`,
  READ_FAILED: "ReadFailed"
} as const;

// Every build writes the same text, so the socket comes from AGGREGOR_API_SOCKET, which Aggregor's sessions have.
export const AGENT_SKILL = {
  AGENTS_FOLDER_NAME: ".agents",
  FILE_NAME: "SKILL.md",
  FOLDER_NAME: "aggregor",
  SKILLS_FOLDER_NAME: "skills",
  TEXT: `---
name: aggregor
description: Manage and configure Aggregor, the VS Code extension that runs coding-agent sessions. Use when the user asks to list, start, open, rename, reorder, archive, stop or remove Aggregor sessions; move a session to a worktree or rename its branch; add, remove, reorder or configure projects; clean up leftover worktrees; import conversations; link pull requests; add or send review comments; write a commit message; set the default agent or add an agent CLI; change Aggregor's settings; or set VS Code up the way Aggregor is meant to look (side bar on the right, activity bar on top, panel at the bottom).
---

# Aggregor

Aggregor's VS Code window serves an HTTP API on a Unix socket:

\`\`\`sh
SOCK="\${AGGREGOR_API_SOCKET:-$HOME/.aggregor/api.sock}"
curl -s --unix-socket "$SOCK" http://aggregor/commands
curl -s --unix-socket "$SOCK" -H 'content-type: application/json' -d '{"sessionId":"..."}' http://aggregor/commands/<commandId>
\`\`\`

- \`GET /commands\` lists every command with its request's JSON Schema; check a body against it before sending. Send no body when a command has none. Leave optional fields out; never send \`null\`.
- Take ids and paths from the reads below, never guess them. Put query values through URL encoding (\`curl -G --data-urlencode projectPath=...\`).
- A success is 200 \`{"result": ...}\`. A failure is \`{"error", "message"}\`: 400 \`InvalidArguments\`, 404 \`CommandNotFound\`, 422 \`CommandFailed\` or \`ReadFailed\`; tell the user its message.
- When curl can't connect (exit code 7: connection refused, or no such socket), no VS Code window with Aggregor is running; tell the user.
- Before a destructive command (removing a session, which deletes its worktree; removing a project; stopping agents; cleaning up leftovers), ask the user, unless they asked for exactly that.

## Reads

- \`GET ${AGENT_API_ROUTES.PROJECTS}\`: each project (\`projectListItem\`: path, name, settings) with its 10 newest sessions (id, title, agent, status, branch, worktree, pull request) and its worktrees. When \`sessionPage.hiddenSessionCount\` is above 0, \`GET ${AGENT_API_ROUTES.PROJECT_SESSIONS}?projectPath=&shownPageCount=N\` returns that project with its 10 × N newest.
- \`GET ${AGENT_API_ROUTES.ARCHIVE}\`: the same for archived sessions.
- \`GET ${AGENT_API_ROUTES.AGENTS}\`: the agents whose command is on PATH, the default first.
- \`GET ${AGENT_API_ROUTES.SETTINGS}\`: every Aggregor setting's current value.
- \`GET ${AGENT_API_ROUTES.PROJECT_BRANCHES}?projectPath=\`, \`${AGENT_API_ROUTES.PROJECT_LEFTOVERS}?projectPath=\`, \`${AGENT_API_ROUTES.PROJECT_IMPORTABLE_SESSIONS}?projectPath=\`.
- \`GET ${AGENT_API_ROUTES.SESSION_PULL_REQUESTS}?sessionId=\`, \`${AGENT_API_ROUTES.SESSION_PROCESSES}?sessionId=\` (what runs in the session's agent terminal and folder shell).
- \`GET ${AGENT_API_ROUTES.REVIEW_COMMENTS}\`: the review comments not sent yet.

## Use cases

Each line is a \`POST /commands/<commandId>\` and the fields its body takes.

Sessions:
- Start one: \`${SESSION_COMMANDS.NEW_IN_CHOSEN_PROJECT}\` with \`projectPath\`, \`workingTree\` and, for an agent other than the default, \`agentId\`. \`workingTree\` is \`{"_tag":"${WORKING_TREE_CHOICE_TAGS.PROJECT_ROOT}"}\`, \`{"_tag":"${WORKING_TREE_CHOICE_TAGS.NEW_WORKTREE}"}\` (with \`baseBranchName\` from the branches read to start from another branch) or \`{"_tag":"${WORKING_TREE_CHOICE_TAGS.EXISTING_WORKTREE}","worktreePath":...}\` (one of the project's \`worktrees\`).
- Show one in its tab: \`${SESSION_COMMANDS.OPEN}\` \`sessionId\`; this resumes an exited session's conversation.
- Rename: \`${SESSION_COMMANDS.RENAME}\` \`sessionId\`, \`customName\` (an empty name hands the title back to the agent). Rename its branch: \`${SESSION_COMMANDS.RENAME_BRANCH}\` \`sessionId\`, \`branchName\`.
- Move to another working tree: \`${SESSION_COMMANDS.CHANGE_WORKING_TREE}\` \`sessionId\`, \`workingTree\`; back to the project root: \`${SESSION_COMMANDS.UNLINK_WORKTREE}\` \`sessionId\`.
- Reorder: \`${SESSION_COMMANDS.MOVE_UP}\`, \`${SESSION_COMMANDS.MOVE_DOWN}\` \`sessionId\`.
- Archive: \`${SESSION_COMMANDS.ARCHIVE}\` and \`${SESSION_COMMANDS.UNARCHIVE}\` \`sessionId\`, \`${SESSION_COMMANDS.ARCHIVE_PROJECT_SESSIONS}\` \`projectPath\`, \`${SESSION_COMMANDS.ARCHIVE_ONGOING}\` (every listed session). An archived agent keeps running.
- Stop agents: \`${SESSION_COMMANDS.STOP_AGENT}\` \`sessionId\`; \`${SESSION_COMMANDS.STOP_PROJECT_AGENTS}\` and \`${SESSION_COMMANDS.STOP_ARCHIVED_PROJECT_AGENTS}\` \`projectPath\`; \`${SESSION_COMMANDS.STOP_ONGOING_AGENTS}\`, \`${SESSION_COMMANDS.STOP_ARCHIVED_AGENTS}\`.
- Remove: \`${SESSION_COMMANDS.REMOVE}\` \`sessionId\` stops its agent and deletes its worktree, keeping the branch.
- Open a terminal: \`${TERMINAL_COMMANDS.OPEN_SESSION_FOLDER_TERMINAL}\` \`sessionId\`, \`${TERMINAL_COMMANDS.OPEN_PROJECT_TERMINAL}\` \`projectPath\`.
- Import earlier conversations: \`${SESSION_COMMANDS.IMPORT}\` \`projectPath\`, \`importedSessions\` copied from the importable-sessions read.

Projects:
- Add: \`${PROJECT_COMMANDS.ADD_FOLDER}\` \`projectPath\`, the absolute path of an existing folder. (\`${PROJECT_COMMANDS.ADD}\` opens VS Code's folder picker for the user instead.)
- Remove from the list: \`${PROJECT_COMMANDS.REMOVE}\` \`projectPath\`. Reorder: \`${PROJECT_COMMANDS.MOVE_UP}\`, \`${PROJECT_COMMANDS.MOVE_DOWN}\` \`projectPath\`.
- Configure: \`${PROJECT_COMMANDS.SAVE_SETTINGS}\` \`projectPath\`, \`settings\`: send the project's whole \`projectListItem.settings\` with your change (\`worktreeFolder\`, \`filesToCopy\`, \`setupScript\` run in each new worktree, \`newSessionWorkingTree\`, \`cleanUpBaseBranch\`).
- Clean up leftover worktrees and \`aggregor/*\` branches: read the leftovers, then \`${WORKTREE_COMMANDS.CLEAN_UP_LEFTOVERS}\` \`projectPath\`, \`branchNames\`, \`worktreePaths\` with the ones to delete.

Pull requests (needs \`gh\`): \`${GITHUB_CLI_COMMANDS.LINK_SESSION_PULL_REQUEST}\` \`sessionId\`, \`pullRequestNumber\` (from the session's pull-requests read); \`${GITHUB_CLI_COMMANDS.UNLINK_SESSION_PULL_REQUEST}\` and \`${GITHUB_CLI_COMMANDS.OPEN_SESSION_PULL_REQUEST}\` \`sessionId\`; \`${GITHUB_CLI_COMMANDS.SIGN_IN}\` opens \`gh auth login\` in a terminal.

Review comments: \`${REVIEW_COMMENT_COMMANDS.ADD}\` \`filePath\` (absolute), \`startLine\`, \`endLine\` (1-based), \`body\`; \`${REVIEW_COMMENT_COMMANDS.EDIT}\` \`reviewCommentId\`, \`body\`; \`${REVIEW_COMMENT_COMMANDS.REMOVE}\` \`reviewCommentId\`; \`${REVIEW_COMMENT_COMMANDS.SEND_TO_SESSION}\` \`sessionId\` pastes the comments under its folder into its agent's prompt; \`${REVIEW_COMMENT_COMMANDS.SEND}\` sends them to the session last in view.

Commit: \`${COMMIT_MESSAGE_COMMANDS.GENERATE}\` \`{"rootUri":{"fsPath":"<repository root>"}}\` writes the staged diff's commit message, then commits and pushes it unless the \`autoCommit\` and \`autoPush\` settings are off.

Agents and settings:
- Default agent: \`${AGENT_COMMANDS.SET_DEFAULT}\` \`agentId\`.
- One setting: \`${SETTINGS_COMMANDS.UPDATE_SETTING}\` \`setting\`, \`value\` (the schema lists each setting and its values); it returns the previous value, to report or undo. \`agents\` adds a CLI, changes a built-in's name, command, arguments, \`env\` or icon, or hides one with \`null\`; it replaces the whole value, so start from the settings read.
- \`${APP_COMMANDS.OPEN_SETTINGS}\` shows Aggregor's settings to the user; \`${REQUIRED_TOOLS_COMMANDS.INSTALL}\` installs a missing tmux or \`gh\` in a terminal.
## VS Code's look

Aggregor is meant to run in VS Code set up like this. When the user asks for that look, or to move the side bar, activity bar or panel, change their VS Code user settings yourself; Aggregor has no command for it.

\`\`\`jsonc
{
  // Layout: files on the right, the activity bar across the top
  "workbench.sideBar.location": "right",
  "workbench.activityBar.location": "top",
  "workbench.layoutControl.enabled": false,
  "workbench.view.alwaysShowHeaderActions": true,
  "window.menuBarVisibility": "compact",
  "debug.toolBarLocation": "commandCenter",
  // Chrome
  "workbench.experimental.modernUI": true,
  "workbench.modernUIFrostedGlass": false,
  "workbench.reduceTransparency": "on",
  "workbench.sizeCustomizations": {"panels.spacing": 8},
  // Editors and tabs
  "workbench.startupEditor": "none",
  "workbench.editor.empty.hint": "hidden",
  "workbench.editor.enablePreview": false,
  "workbench.editor.highlightModifiedTabs": true,
  "workbench.editor.tabSizingFixedMaxWidth": 50,
  "editor.minimap.enabled": false,
  "editor.stickyScroll.enabled": false,
  "terminal.integrated.stickyScroll.enabled": false,
  // Trees
  "workbench.tree.indent": 15,
  "workbench.tree.renderIndentGuides": "none",
  "workbench.tree.enableStickyScroll": false,
  "explorer.compactFolders": false
}
\`\`\`

- The file is \`~/.config/Code/User/settings.json\` on Linux and \`~/Library/Application Support/Code/User/settings.json\` on macOS (\`Code - Insiders\` for Insiders). A window on another profile reads \`User/profiles/<id>/settings.json\`; ask which one when unsure.
- It is JSON with comments and trailing commas: change or add only these keys with a small edit, and keep every other line and comment. Before writing, show the user the keys you will change with their current values, and apply only what they agree to. VS Code applies the change without a reload.
- The panel's alignment is window layout, not a setting: for the panel at the bottom spanning the right, tell the user to run **Set Panel Alignment to Right** from the Command Palette.
`
} as const;

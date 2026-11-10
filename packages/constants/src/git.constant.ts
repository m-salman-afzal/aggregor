// The built-in Git extension: its id, the version of its API Aggregor asks for, and its command that stages every change.
export const GIT_EXTENSION = {
  API_VERSION: 1,
  ID: "vscode.git",
  STAGE_ALL_COMMAND: "git.stageAll"
} as const;

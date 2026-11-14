export const PROJECT_COMMANDS = {
  ADD: "aggregorApp.addProject",
  MOVE_DOWN: "aggregorApp.moveProjectDown",
  MOVE_UP: "aggregorApp.moveProjectUp",
  REMOVE: "aggregorApp.removeProject",
  SAVE_SETTINGS: "aggregorApp.saveProjectSettings"
} as const;

export const PROJECT_LABELS = {
  ADD_FOLDERS: "Add Project"
} as const;

export const PROJECT_SETTINGS_LABELS = {
  FILES_TO_COPY: "Files to copy into a new worktree",
  FILES_TO_COPY_HINT: "Patterns, separated by commas. A .worktreeinclude in the project replaces them.",
  NEW_SESSION_WORKING_TREE: "New sessions start in",
  SAVE: "Save",
  SETUP_SCRIPT: "Setup script",
  SETUP_SCRIPT_HINT: "Runs in each new worktree before its agent starts.",
  TITLE: (projectName: string) => `${projectName} settings`,
  WORKING_TREE_PROJECT_ROOT: "Project root",
  WORKING_TREE_WORKTREE: "New worktree",
  WORKTREE_FOLDER: "Worktree folder",
  WORKTREE_FOLDER_PLACEHOLDER: "Aggregor's folder (~/.aggregor/worktrees)"
} as const;

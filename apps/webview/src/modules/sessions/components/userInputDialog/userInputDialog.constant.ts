import {
  BroomIcon,
  CircleHelpIcon,
  PencilLineIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  TriangleAlertIcon
} from "lucide-react";

export const USER_INPUT_ICONS = {
  CLEAN_UP: BroomIcon,
  DESTRUCTIVE_QUESTION: TriangleAlertIcon,
  NEW_SESSION: PlusIcon,
  PROJECT_SETTINGS: SlidersHorizontalIcon,
  QUESTION: CircleHelpIcon,
  TEXT: PencilLineIcon
} as const;

export const PROJECT_SETTINGS_FIELDS = {
  FILES_TO_COPY: "filesToCopy",
  NEW_SESSION_WORKING_TREE: "newSessionWorkingTree",
  SETUP_SCRIPT: "setupScript",
  WORKTREE_FOLDER: "worktreeFolder"
} as const;

// The extension's SESSION_WORKING_TREES, which the webview can't import from the domain.
export const SESSION_WORKING_TREES = {
  PROJECT_ROOT: "projectRoot",
  WORKTREE: "worktree"
} as const;

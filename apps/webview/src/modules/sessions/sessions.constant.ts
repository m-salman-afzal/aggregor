import {APP_COMMANDS, APP_LABELS} from "@pkg/constants/src/app.constant.ts";
import {LEFTOVER_LABELS, WORKTREE_COMMANDS} from "@pkg/constants/src/git.constant.ts";
import {PROJECT_COMMANDS, PROJECT_LABELS} from "@pkg/constants/src/project.constant.ts";
import {SESSION_COMMANDS} from "@pkg/constants/src/session.constant.ts";
import {SESSIONS_WEBVIEW} from "@pkg/constants/src/sessionsView.constant.ts";
import {TERMINAL_COMMANDS} from "@pkg/constants/src/terminal.constant.ts";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BroomIcon,
  CircleStopIcon,
  FolderMinusIcon,
  FolderPlusIcon,
  GitBranchIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  SquareTerminalIcon,
  Trash2Icon
} from "lucide-react";

import type {RowAction} from "@/modules/sessions/sessions.type.ts";

export const SESSIONS_LABELS = {
  ARCHIVE_EMPTY:
    "Sessions you are done with move here when you archive them from a … menu in the Sessions list: a session's, a " +
    "project's or the list's.",
  ARCHIVE_TITLE: "Archive",
  DETAIL_SEPARATOR: " · ",

  MISSING_AGENT: "Agent not in settings",
  MORE_ACTIONS: "More Actions…",
  NO_PROJECTS: "No projects yet.",
  OK: "OK",
  PROGRESS: (statusProgress: number) => `${statusProgress}%`,
  SESSIONS_TITLE: "Sessions",
  USER_INPUT_TEXT_FIELD: "userInputText",
  WAITING_COUNT: (waitingCount: number) => `${waitingCount} waiting on you`
} as const;

// theme.css maps a named accent from data-accent; a colour of the user's own reaches it as CSS, with the text size.
export const APPEARANCE = {
  ACCENT_CSS: (accentColor: string) => `:root{--aggregor-accent:${accentColor}}`,
  CUSTOM_ACCENT: "custom",
  CUSTOM_ACCENT_PREFIX: "#",
  FONT_SIZE_CSS: (fontSize: number) => `:root{--aggregor-font-size:${fontSize}px}`,
  STYLE_NONCE_META_SELECTOR: `meta[property="${SESSIONS_WEBVIEW.STYLE_NONCE_META_PROPERTY}"]`
} as const;

export const USER_INPUT_TAGS = {
  CLEAN_UP: "CleanUpInput",
  NEW_SESSION: "NewSessionInput",
  PROJECT_SETTINGS: "ProjectSettingsInput",
  QUESTION: "QuestionInput",
  TEXT: "TextInput"
} as const;

export const SESSION_LISTS = {
  ARCHIVE: "archive",
  SESSIONS: "sessions"
} as const;

const MOVE_ROW_LABEL = "Move";

export const ROW_ACTIONS = {
  ADD_PROJECT: {commandId: PROJECT_COMMANDS.ADD, icon: FolderPlusIcon, label: PROJECT_LABELS.ADD_FOLDERS},
  ARCHIVE: {commandId: SESSION_COMMANDS.ARCHIVE, icon: ArchiveIcon, label: "Archive"},
  ARCHIVE_ONGOING: {commandId: SESSION_COMMANDS.ARCHIVE_ONGOING, icon: ArchiveIcon, label: "Archive All Sessions"},
  ARCHIVE_PROJECT_SESSIONS: {
    commandId: SESSION_COMMANDS.ARCHIVE_PROJECT_SESSIONS,
    icon: ArchiveIcon,
    label: "Archive Sessions"
  },
  CLEAN_UP_LEFTOVERS: {
    commandId: WORKTREE_COMMANDS.CLEAN_UP_LEFTOVERS,
    hasAttentionDot: true,
    icon: BroomIcon,
    label: LEFTOVER_LABELS.CLEAN_UP
  },
  MOVE_PROJECT_DOWN: {
    commandId: PROJECT_COMMANDS.MOVE_DOWN,
    icon: ArrowDownIcon,
    label: "Move Down",
    sharedRowLabel: MOVE_ROW_LABEL
  },
  MOVE_PROJECT_UP: {
    commandId: PROJECT_COMMANDS.MOVE_UP,
    icon: ArrowUpIcon,
    label: "Move Up",
    sharedRowLabel: MOVE_ROW_LABEL
  },
  MOVE_SESSION_DOWN: {
    commandId: SESSION_COMMANDS.MOVE_DOWN,
    icon: ArrowDownIcon,
    label: "Move Down",
    sharedRowLabel: MOVE_ROW_LABEL
  },
  MOVE_SESSION_UP: {
    commandId: SESSION_COMMANDS.MOVE_UP,
    icon: ArrowUpIcon,
    label: "Move Up",
    sharedRowLabel: MOVE_ROW_LABEL
  },
  NEW_SESSION: {commandId: SESSION_COMMANDS.NEW_IN_CHOSEN_PROJECT, icon: PlusIcon, label: "New Session"},
  NEW_SESSION_ASKING_FOR_PROJECT: {
    commandId: SESSION_COMMANDS.NEW_IN_CHOSEN_PROJECT,
    icon: PlusIcon,
    label: "New Session…"
  },
  NEW_TERMINAL: {commandId: TERMINAL_COMMANDS.NEW_PROJECT_TERMINAL, icon: SquareTerminalIcon, label: "New Terminal"},
  OPEN_SETTINGS: {commandId: APP_COMMANDS.OPEN_SETTINGS, icon: SettingsIcon, label: APP_LABELS.OPEN_SETTINGS},
  PROJECT_SETTINGS: {
    commandId: PROJECT_COMMANDS.SAVE_SETTINGS,
    icon: SlidersHorizontalIcon,
    label: "Project Settings…"
  },
  REMOVE_PROJECT: {
    commandId: PROJECT_COMMANDS.REMOVE,
    icon: FolderMinusIcon,
    isDestructive: true,
    label: "Remove Project"
  },
  REMOVE_SESSION: {commandId: SESSION_COMMANDS.REMOVE, icon: Trash2Icon, isDestructive: true, label: "Remove"},
  RENAME_BRANCH: {commandId: SESSION_COMMANDS.RENAME_BRANCH, icon: GitBranchIcon, label: "Rename Branch…"},
  RENAME_SESSION: {commandId: SESSION_COMMANDS.RENAME, icon: PencilIcon, label: "Rename"},
  STOP_AGENT: {commandId: SESSION_COMMANDS.STOP_AGENT, icon: CircleStopIcon, label: "Stop Agent"},
  STOP_ARCHIVED_AGENTS: {
    commandId: SESSION_COMMANDS.STOP_ARCHIVED_AGENTS,
    icon: CircleStopIcon,
    label: "Stop All Agents"
  },
  STOP_ARCHIVED_PROJECT_AGENTS: {
    commandId: SESSION_COMMANDS.STOP_ARCHIVED_PROJECT_AGENTS,
    icon: CircleStopIcon,
    label: "Stop Agents"
  },
  STOP_ONGOING_AGENTS: {
    commandId: SESSION_COMMANDS.STOP_ONGOING_AGENTS,
    icon: CircleStopIcon,
    label: "Stop All Agents"
  },
  STOP_PROJECT_AGENTS: {commandId: SESSION_COMMANDS.STOP_PROJECT_AGENTS, icon: CircleStopIcon, label: "Stop Agents"},
  UNARCHIVE: {commandId: SESSION_COMMANDS.UNARCHIVE, icon: ArchiveRestoreIcon, label: "Unarchive"}
} as const satisfies Record<string, RowAction>;

export const LIST_INLINE_ACTIONS = {
  [SESSION_LISTS.ARCHIVE]: [],
  [SESSION_LISTS.SESSIONS]: [
    ROW_ACTIONS.NEW_SESSION_ASKING_FOR_PROJECT,
    ROW_ACTIONS.ADD_PROJECT,
    ROW_ACTIONS.OPEN_SETTINGS
  ]
} as const;

export const LIST_ACTION_GROUPS = {
  [SESSION_LISTS.ARCHIVE]: [[ROW_ACTIONS.STOP_ARCHIVED_AGENTS]],
  [SESSION_LISTS.SESSIONS]: [[ROW_ACTIONS.STOP_ONGOING_AGENTS, ROW_ACTIONS.ARCHIVE_ONGOING]]
} as const;

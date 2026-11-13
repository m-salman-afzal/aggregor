import {APP_COMMANDS, APP_LABELS} from "@pkg/constants/src/app.constant.ts";
import {PROJECT_COMMANDS, PROJECT_LABELS} from "@pkg/constants/src/project.constant.ts";
import {SESSION_COMMANDS} from "@pkg/constants/src/session.constant.ts";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CircleStopIcon,
  FolderMinusIcon,
  FolderPlusIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
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
  PROMPT_TEXT_FIELD: "promptText",
  SESSIONS_TITLE: "Sessions",
  WAITING_COUNT: (waitingCount: number) => `${waitingCount} waiting on you`
} as const;

export const APPEARANCE_PROPERTIES = {
  ACCENT: "--aggregor-accent",
  FONT_SIZE: "--aggregor-font-size",
  SHADE: "--aggregor-shade"
} as const;

export const ACCENT_SOURCES: Readonly<Record<string, {readonly accent: string; readonly shade: string}>> = {
  neutral: {accent: "var(--vscode-focusBorder)", shade: "var(--foreground)"},
  palette: {accent: "var(--vscode-terminal-ansiBlue)", shade: "var(--brand)"},
  theme: {accent: "var(--vscode-activityBarBadge-background)", shade: "var(--brand)"}
};

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
    commandId: SESSION_COMMANDS.NEW_ASKING_FOR_PROJECT,
    icon: PlusIcon,
    label: "New Session…"
  },
  OPEN_SETTINGS: {commandId: APP_COMMANDS.OPEN_SETTINGS, icon: SettingsIcon, label: APP_LABELS.OPEN_SETTINGS},
  REMOVE_PROJECT: {
    commandId: PROJECT_COMMANDS.REMOVE,
    icon: FolderMinusIcon,
    isDestructive: true,
    label: "Remove Project"
  },
  REMOVE_SESSION: {commandId: SESSION_COMMANDS.REMOVE, icon: Trash2Icon, isDestructive: true, label: "Remove"},
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

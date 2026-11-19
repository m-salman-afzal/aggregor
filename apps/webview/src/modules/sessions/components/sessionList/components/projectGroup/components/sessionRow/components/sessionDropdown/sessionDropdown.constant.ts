import {
  BotIcon,
  CircleDotIcon,
  CloudIcon,
  EyeIcon,
  PlugIcon,
  SquareTerminalIcon,
  UsersIcon,
  WorkflowIcon
} from "lucide-react";

import type {SessionTaskDto} from "@dtos/session.dto.ts";
import type {LucideIcon} from "lucide-react";

export const SESSION_DROPDOWN_LABELS = {
  TASKS: "Tasks"
} as const;

export const TASK_KIND_ICONS = {
  mcpTask: {label: "MCP task", TaskKindIcon: PlugIcon},
  monitor: {label: "Monitor", TaskKindIcon: EyeIcon},
  other: {label: "Task", TaskKindIcon: CircleDotIcon},
  remoteAgent: {label: "Remote agent", TaskKindIcon: CloudIcon},
  shell: {label: "Background shell", TaskKindIcon: SquareTerminalIcon},
  subAgent: {label: "Sub-agent", TaskKindIcon: BotIcon},
  teammate: {label: "Teammate", TaskKindIcon: UsersIcon},
  workflow: {label: "Workflow", TaskKindIcon: WorkflowIcon}
} satisfies Record<SessionTaskDto["kind"], {label: string; TaskKindIcon: LucideIcon}>;

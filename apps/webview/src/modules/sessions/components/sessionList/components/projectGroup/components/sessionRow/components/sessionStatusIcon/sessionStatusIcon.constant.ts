import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleIcon,
  CircleXIcon,
  LoaderCircleIcon,
  RotateCcwIcon
} from "lucide-react";

import type {SessionListItemDto} from "@dtos/session.dto.ts";
import type {LucideIcon} from "lucide-react";

export const SESSION_STATUS_ICONS = {
  blocked: {className: "text-status-blocked", StatusIcon: CircleAlertIcon},
  done: {className: "text-status-done", StatusIcon: CircleCheckIcon},
  error: {className: "text-status-error", StatusIcon: CircleXIcon},
  exited: {className: "text-status-exited", StatusIcon: CircleDashedIcon},
  idle: {className: "text-status-idle", StatusIcon: CircleIcon},
  interrupted: {className: "text-status-interrupted", StatusIcon: RotateCcwIcon},
  working: {className: "text-status-working motion-ok:animate-spin", StatusIcon: LoaderCircleIcon}
} satisfies Record<SessionListItemDto["status"], {className: string; StatusIcon: LucideIcon}>;

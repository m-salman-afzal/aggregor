import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleIcon,
  CircleXIcon,
  LoaderCircleIcon
} from "lucide-react";

import type {SessionListItemDto} from "@dtos/session.dto.ts";
import type {LucideIcon} from "lucide-react";

// Each status's icon and color; the row's second line says the status in words.
export const SESSION_STATUS_ICONS = {
  blocked: {className: "text-status-blocked", StatusIcon: CircleAlertIcon},
  done: {className: "text-status-done", StatusIcon: CircleCheckIcon},
  error: {className: "text-status-error", StatusIcon: CircleXIcon},
  exited: {className: "text-status-exited", StatusIcon: CircleDashedIcon},
  idle: {className: "text-status-idle", StatusIcon: CircleIcon},
  working: {className: "animate-spin text-status-working", StatusIcon: LoaderCircleIcon}
} satisfies Record<SessionListItemDto["status"], {className: string; StatusIcon: LucideIcon}>;

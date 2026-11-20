import type {SessionListItemDto} from "@dtos/session.dto.ts";

export const ALWAYS_SHOWN_ACTION_BAR = "flex shrink-0 items-center gap-1 pr-2";

export const HOVER_ACTION_BAR =
  "absolute inset-y-0 right-0 flex items-center gap-1 rounded-r-lg bg-inherit pr-1.5 pl-2 opacity-0 " +
  "transition-opacity duration-150 group-hover/row:opacity-100 group-has-focus-visible/row:opacity-100 " +
  "has-data-popup-open:opacity-100 [@media(hover:none)]:opacity-100";

export const ROW_SURFACE =
  "group/row relative flex min-w-0 items-center rounded-lg bg-level transition-colors duration-150 " +
  "hover:[--level:1] has-focus-visible:[--level:1] has-data-popup-open:[--level:1]";

export const HEADER_SURFACE = "group/row relative flex min-w-0 items-center";

export const ACTION_BUTTON =
  "size-7 rounded-lg text-muted-foreground hover:text-foreground-strong aria-expanded:text-foreground-strong";

export const ACTION_ICON = "size-4";

export const ATTENTION_DOT = "absolute top-1 right-1 size-1.5 rounded-full bg-destructive";

export const TURN_RUNNING_STATUSES: readonly SessionListItemDto["status"][] = ["working", "blocked"];

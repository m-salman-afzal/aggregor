import {CircleHelpIcon, ListIcon, PencilLineIcon, TriangleAlertIcon} from "lucide-react";

export const PROMPT_ICONS = {
  CHOICE: ListIcon,
  DESTRUCTIVE_QUESTION: TriangleAlertIcon,
  QUESTION: CircleHelpIcon,
  TEXT: PencilLineIcon
} as const;

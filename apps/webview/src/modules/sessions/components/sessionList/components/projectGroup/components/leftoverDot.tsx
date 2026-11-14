import {LEFTOVER_LABELS} from "@pkg/constants/src/git.constant.ts";

export const LeftoverDot = () => (
  <span
    aria-label={LEFTOVER_LABELS.HAS_LEFTOVERS}
    className="size-1.5 shrink-0 rounded-full bg-destructive"
    role="img"
    title={LEFTOVER_LABELS.HAS_LEFTOVERS}
  />
);

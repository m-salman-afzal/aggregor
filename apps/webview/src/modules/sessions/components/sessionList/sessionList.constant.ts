// A panel clips what it holds while it moves, so focus rings inside it are drawn inset.
export const PROJECT_PANEL =
  "h-(--collapsible-panel-height) overflow-hidden data-ending-style:h-0 data-starting-style:h-0 " +
  "motion-ok:transition-[height] motion-ok:duration-200 motion-ok:ease-out";

export const ARCHIVE_PANEL =
  "scrollbar-minimal h-[40vh] overflow-y-auto data-ending-style:h-0 data-starting-style:h-0 motion-ok:transition-[height] " +
  "motion-ok:duration-250 motion-ok:ease-out";

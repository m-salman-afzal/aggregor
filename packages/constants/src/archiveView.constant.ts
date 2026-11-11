// The Archive view, under Sessions in the Aggregor container: the sessions the user is done with.
export const ARCHIVE_VIEW = {
  ID: "aggregorApp.archive"
} as const;

// The view's name, as the manifest gives it, and with the number of its sessions waiting on the user.
export const ARCHIVE_VIEW_LABELS = {
  TITLE: "Archive",
  TITLE_WITH_WAITING_COUNT: (waitingCount: number) => `Archive (${waitingCount})`
} as const;

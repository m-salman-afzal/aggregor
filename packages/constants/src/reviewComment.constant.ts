export const REVIEW_COMMENT_COMMANDS = {
  ADD: "aggregorApp.addReviewComment",
  EDIT: "aggregorApp.editReviewComment",
  REMOVE: "aggregorApp.removeReviewComment",
  SEND: "aggregorApp.sendReviewComments"
} as const;

export const REVIEW_COMMENTS_VIEW_GESTURES = {
  CANCEL_EDIT: "aggregorApp.cancelReviewCommentEdit",
  SEND_SHOWN: "aggregorApp.sendShownReviewComments",
  START_EDIT: "aggregorApp.startReviewCommentEdit",
  SUBMIT_DRAFT: "aggregorApp.submitReviewCommentDraft"
} as const;

export const REVIEW_COMMENTS_VIEW = {
  AUTHOR_NAME: "You",
  COMMENTABLE_URI_SCHEME: "file",
  CONTROLLER_ID: "aggregorApp.reviewComments",
  CONTROLLER_LABEL: "Aggregor",
  DRAFT_PLACEHOLDER: "Comment for the session's agent",
  DRAFT_PROMPT: "Comment for the session's agent",
  LINE_BREAK: "\n",
  // Past any line's end, where VS Code cuts a range off, so a thread's highlight covers its last line whole.
  LINE_END_CHARACTER: 1_000_000
} as const;

export const REVIEW_COMMENT_ERRORS = {
  NO_REVIEW_COMMENTS: "There are no comments to send. Add one with the + beside a line.",
  NO_SESSION_FOR_REVIEW_COMMENTS: "No session you have opened works in the folder of the commented files.",
  SESSION_AGENT_NOT_RUNNING: (sessionDisplayName: string) =>
    `"${sessionDisplayName}" isn't running its agent. Open the session, then send the comments again.`,
  SESSION_NOT_SHOWN: (sessionDisplayName: string) =>
    `The comments were sent to "${sessionDisplayName}", but it could not be brought into view. The trace log has the reason.`
} as const;

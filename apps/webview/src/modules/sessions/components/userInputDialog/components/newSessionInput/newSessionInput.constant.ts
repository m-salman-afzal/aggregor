// The base branch's id when the worktree starts from the project's current commit.
export const CURRENT_COMMIT_OPTION_ID = "";

export const OPTION_ROW =
  "flex min-w-0 items-center rounded-xl bg-level [--level:2] ring-1 ring-hairline ring-inset " +
  "transition-[background-color,box-shadow] duration-150 hover:[--level:3] has-checked:ring-2 has-checked:ring-brand/60 " +
  "has-focus-visible:ring-2 has-focus-visible:ring-ring";

export const NEW_SESSION_FIELDS = {
  AGENT: "agent",
  BASE_BRANCH: "baseBranch",
  PROJECT: "project",
  WORKING_TREE: "workingTree"
} as const;

export const OPTION_PICKER_TRIGGER =
  "flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-xl bg-level px-3 py-2 text-left [--level:2] " +
  "ring-1 ring-hairline ring-inset transition-[background-color,box-shadow] duration-150 hover:[--level:3] " +
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-popup-open:[--level:3] data-popup-open:ring-2 " +
  "data-popup-open:ring-brand/60 [&>svg]:ml-auto";

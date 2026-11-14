export const OPTION_ROW =
  "flex min-w-0 items-center rounded-xl bg-level [--level:2] ring-1 ring-hairline ring-inset " +
  "transition-[background-color,box-shadow] duration-150 hover:[--level:3] has-checked:ring-2 has-checked:ring-brand/60 " +
  "has-focus-visible:ring-2 has-focus-visible:ring-ring";

export const NEW_SESSION_FIELDS = {
  AGENT: "agent",
  PROJECT: "project",
  WORKING_TREE: "workingTree"
} as const;

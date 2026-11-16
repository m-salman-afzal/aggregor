import {GitMergeIcon, GitPullRequestClosedIcon, GitPullRequestDraftIcon, GitPullRequestIcon} from "lucide-react";

import type {SessionPullRequestDto} from "@dtos/session.dto.ts";
import type {LucideIcon} from "lucide-react";

export const VIEWED_ROW =
  "[--level:2] hover:[--level:2] has-focus-visible:[--level:2] " +
  "has-data-popup-open:[--level:2] before:absolute before:inset-y-2.5 before:left-1 before:w-[3px] " +
  "before:rounded-full before:bg-linear-to-b before:from-brand before:to-brand-end";

// A click on the pull request opens it rather than the session; the row's … menu opens it from the keyboard.
export const PULL_REQUEST_LINK_ATTRIBUTE = "data-pull-request-link";

export const PULL_REQUEST_STATE_ICONS = {
  closed: {className: "text-pull-request-closed", PullRequestIcon: GitPullRequestClosedIcon},
  draft: {className: "text-pull-request-draft", PullRequestIcon: GitPullRequestDraftIcon},
  merged: {className: "text-pull-request-merged", PullRequestIcon: GitMergeIcon},
  open: {className: "text-pull-request-open", PullRequestIcon: GitPullRequestIcon}
} satisfies Record<SessionPullRequestDto["state"], {className: string; PullRequestIcon: LucideIcon}>;

export const AGENT_ICON =
  "size-4.5 shrink-0 opacity-60 transition-opacity duration-150 group-hover/row:opacity-100 " +
  "in-aria-[current=true]:opacity-100";

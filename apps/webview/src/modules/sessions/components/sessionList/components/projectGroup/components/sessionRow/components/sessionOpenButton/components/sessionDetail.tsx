import {SessionDiffStats} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionOpenButton/components/sessionDiffStats.tsx";
import {SessionPullRequest} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionOpenButton/components/sessionPullRequest.tsx";
import {SessionReviewComments} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionOpenButton/components/sessionReviewComments/sessionReviewComments.tsx";
import {AGENT_ICON} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionOpenButton/sessionOpenButton.constant.ts";
import {GitBranchIcon, TriangleAlertIcon} from "lucide-react";

import type {SessionListItemDto} from "@dtos/session.dto.ts";

interface SessionDetailProps {
  readonly agentIconUri?: string | undefined;
  readonly agentLabel: string;
  readonly sessionListItem: SessionListItemDto;
}

export const SessionDetail = (props: SessionDetailProps) => (
  <span className="flex min-w-0 items-center gap-2 pl-6 text-xs text-muted-foreground">
    {props.agentIconUri === undefined ? (
      <TriangleAlertIcon aria-label={props.agentLabel} className={AGENT_ICON} role="img">
        <title>{props.agentLabel}</title>
      </TriangleAlertIcon>
    ) : (
      <img alt={props.agentLabel} className={AGENT_ICON} src={props.agentIconUri} title={props.agentLabel} />
    )}
    {props.sessionListItem.pullRequest !== undefined && (
      <SessionPullRequest pullRequest={props.sessionListItem.pullRequest} />
    )}
    {props.sessionListItem.diffStats !== undefined && props.sessionListItem.diffStats.changedFileCount > 0 && (
      <SessionDiffStats diffStats={props.sessionListItem.diffStats} />
    )}
    {props.sessionListItem.pendingReviewCommentCount > 0 && (
      <SessionReviewComments pendingReviewCommentCount={props.sessionListItem.pendingReviewCommentCount} />
    )}
    {props.sessionListItem.branchName !== undefined && (
      <span className="flex min-w-0 items-center gap-1" title={props.sessionListItem.branchName}>
        <GitBranchIcon aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{props.sessionListItem.branchName}</span>
      </span>
    )}
  </span>
);

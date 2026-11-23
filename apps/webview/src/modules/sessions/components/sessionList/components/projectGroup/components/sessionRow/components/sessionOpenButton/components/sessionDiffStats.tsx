import {FileDiffIcon} from "lucide-react";

import {SESSION_ROW_LABELS} from "@pkg/constants/src/sessionsView.constant.ts";

import type {SessionDiffStatsDto} from "@/dtos/session.dto.ts";

interface SessionDiffStatsProps {
  readonly diffStats: SessionDiffStatsDto;
}

export const SessionDiffStats = (props: SessionDiffStatsProps) => (
  <span
    className="flex shrink-0 items-center gap-1 tabular-nums"
    title={SESSION_ROW_LABELS.DIFF_STATS_TOOLTIP(
      props.diffStats.changedFileCount,
      props.diffStats.insertionCount,
      props.diffStats.deletionCount
    )}>
    <FileDiffIcon aria-hidden className="size-3.5 shrink-0" />
    <span>{props.diffStats.changedFileCount}</span>
    <span className="flex flex-col text-[10px] leading-none">
      <span className="text-diff-added">+{props.diffStats.insertionCount}</span>
      <span className="text-diff-deleted">−{props.diffStats.deletionCount}</span>
    </span>
  </span>
);

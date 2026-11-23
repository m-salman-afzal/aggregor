import {cn} from "cn";

interface CountBadgeProps {
  readonly count: number;
  readonly isAttention?: boolean | undefined;
  readonly label?: string | undefined;
}

export const CountBadge = (props: CountBadgeProps) => (
  <span
    aria-label={props.label}
    className={cn(
      "inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-lift-1 px-1.5 text-[0.6875rem] leading-none font-medium text-muted-foreground tabular-nums",
      {"bg-status-blocked/20 text-status-blocked": props.isAttention === true}
    )}
    title={props.label}>
    {props.count}
  </span>
);

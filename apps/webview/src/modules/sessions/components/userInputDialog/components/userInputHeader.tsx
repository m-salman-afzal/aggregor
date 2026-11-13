import {DialogTitle} from "@pkg/ui/src/components/base/dialog.tsx";
import {cn} from "cn";

import type {LucideIcon} from "lucide-react";

interface UserInputHeaderProps {
  readonly Icon: LucideIcon | undefined;
  readonly isDestructive: boolean;
  readonly title: string | undefined;
}

export const UserInputHeader = (props: UserInputHeaderProps) => (
  <div className="flex items-start gap-3">
    {props.Icon !== undefined && (
      <span
        className={cn("flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-end/18 text-brand-end", {
          "bg-destructive/18 text-destructive": props.isDestructive
        })}>
        <props.Icon aria-hidden className="size-4" />
      </span>
    )}
    <DialogTitle className="min-w-0 self-center text-[0.9375rem] leading-snug font-semibold text-pretty text-foreground-strong">
      {props.title}
    </DialogTitle>
  </div>
);

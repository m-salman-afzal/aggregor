import {Button} from "@pkg/ui/src/components/base/button.tsx";

import type {LucideIcon} from "lucide-react";

interface SecondaryActionButtonProps {
  readonly Icon: LucideIcon | undefined;
  readonly label: string;
  readonly onClick: () => void;
}

// An icon button when the action has an icon, so the choice's name keeps its room in a narrow view.
export const SecondaryActionButton = (props: SecondaryActionButtonProps) => {
  if (props.Icon === undefined)
    return (
      <Button className="mr-1.5 shrink-0" onClick={props.onClick} size="xs" variant="soft">
        {props.label}
      </Button>
    );

  return (
    <Button
      aria-label={props.label}
      className="mr-2 shrink-0 text-muted-foreground hover:text-foreground-strong"
      onClick={props.onClick}
      size="icon-sm"
      title={props.label}
      variant="soft">
      <props.Icon aria-hidden className="size-4" />
    </Button>
  );
};

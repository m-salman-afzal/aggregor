import {DropdownMenuItem} from "@pkg/ui/src/components/base/dropdown-menu.tsx";
import {ArrowUpDownIcon} from "lucide-react";

import type {RowAction} from "@/modules/sessions/sessions.type.ts";

interface SharedActionRowProps {
  readonly label: string;
  readonly onRunAction: (rowAction: RowAction) => void;
  readonly rowActions: readonly RowAction[];
}

export const SharedActionRow = (props: SharedActionRowProps) => (
  <div className="flex items-center gap-1 py-0.5 pr-0.5 pl-2 text-sm">
    <ArrowUpDownIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    <span className="flex-1 pl-1">{props.label}</span>
    {props.rowActions.map((rowAction) => (
      <DropdownMenuItem
        aria-label={rowAction.label}
        className="size-7 justify-center bg-lift-1 p-0 focus:bg-lift-2"
        key={rowAction.commandId}
        onClick={() => {
          props.onRunAction(rowAction);
        }}
        title={rowAction.label}>
        <rowAction.icon aria-hidden />
      </DropdownMenuItem>
    ))}
  </div>
);

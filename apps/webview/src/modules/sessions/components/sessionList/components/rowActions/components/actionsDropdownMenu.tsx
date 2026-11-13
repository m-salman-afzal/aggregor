import {ActionMenuItems} from "@/modules/sessions/components/sessionList/components/rowActions/components/actionMenuItems.tsx";
import {
  ACTION_BUTTON,
  ACTION_ICON
} from "@/modules/sessions/components/sessionList/components/rowActions/rowActions.constant.ts";
import {SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";
import {Button} from "@pkg/ui/src/components/base/button.tsx";
import {DropdownMenu, DropdownMenuContent, DropdownMenuTrigger} from "@pkg/ui/src/components/base/dropdown-menu.tsx";
import {EllipsisIcon} from "lucide-react";

import type {MenuGroup} from "@/modules/sessions/components/sessionList/components/rowActions/rowActions.type.ts";
import type {RowAction} from "@/modules/sessions/sessions.type.ts";

interface ActionsDropdownMenuProps {
  readonly menuGroups: readonly MenuGroup[];
  readonly onRunAction: (rowAction: RowAction) => void;
}

export const ActionsDropdownMenu = (props: ActionsDropdownMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        <Button
          aria-label={SESSIONS_LABELS.MORE_ACTIONS}
          className={ACTION_BUTTON}
          size="icon-xs"
          title={SESSIONS_LABELS.MORE_ACTIONS}
          variant="soft"
        />
      }>
      <EllipsisIcon aria-hidden className={ACTION_ICON} />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-auto min-w-40">
      <ActionMenuItems menuGroups={props.menuGroups} onRunAction={props.onRunAction} />
    </DropdownMenuContent>
  </DropdownMenu>
);

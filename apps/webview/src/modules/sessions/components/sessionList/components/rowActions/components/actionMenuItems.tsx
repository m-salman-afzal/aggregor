import {SharedActionRow} from "@/modules/sessions/components/sessionList/components/rowActions/components/sharedActionRow.tsx";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator
} from "@pkg/ui/src/components/base/dropdown-menu.tsx";

import type {MenuGroup} from "@/modules/sessions/components/sessionList/components/rowActions/rowActions.type.ts";
import type {RowAction} from "@/modules/sessions/sessions.type.ts";

interface ActionMenuItemsProps {
  readonly menuGroups: readonly MenuGroup[];
  readonly onRunAction: (rowAction: RowAction) => void;
}

// Base UI's context menu is built from its menu's parts, so the … menu and the right-click menu draw the same items.
export const ActionMenuItems = (props: ActionMenuItemsProps) =>
  props.menuGroups.map((menuGroup, groupIndex) => (
    <DropdownMenuGroup key={menuGroup.groupKey}>
      {groupIndex > 0 && <DropdownMenuSeparator />}
      {menuGroup.sharedRowLabel !== undefined && (
        <SharedActionRow
          label={menuGroup.sharedRowLabel}
          onRunAction={props.onRunAction}
          rowActions={menuGroup.rowActions}
        />
      )}
      {menuGroup.sharedRowLabel === undefined &&
        menuGroup.rowActions.map((rowAction) => (
          <DropdownMenuItem
            key={rowAction.commandId}
            onClick={() => {
              props.onRunAction(rowAction);
            }}
            variant={rowAction.isDestructive === true ? "destructive" : "default"}>
            <rowAction.icon aria-hidden />
            {rowAction.label}
          </DropdownMenuItem>
        ))}
    </DropdownMenuGroup>
  ));

import {ActionMenuItems} from "@/modules/sessions/components/sessionList/components/rowActions/components/actionMenuItems.tsx";
import {ActionsDropdownMenu} from "@/modules/sessions/components/sessionList/components/rowActions/components/actionsDropdownMenu.tsx";
import {InlineActionButtons} from "@/modules/sessions/components/sessionList/components/rowActions/components/inlineActionButtons.tsx";
import {useRowActions} from "@/modules/sessions/components/sessionList/components/rowActions/rowActions.hook.ts";
import {ContextMenu, ContextMenuContent, ContextMenuTrigger} from "@pkg/ui/src/components/base/context-menu.tsx";
import {cn} from "cn";

import type {RowAction} from "@/modules/sessions/sessions.type.ts";
import type {RowCommandArgument} from "@views/sessions/sessions.view.type.ts";
import type {ReactNode} from "react";

interface RowActionsProps {
  readonly actionGroups: readonly (readonly RowAction[])[];
  readonly areActionsAlwaysShown?: boolean | undefined;
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly commandArgument?: RowCommandArgument | undefined;
  readonly inlineActions?: readonly RowAction[] | undefined;
}

export const RowActions = (props: RowActionsProps) => {
  const rowActionsView = useRowActions(props);

  return (
    <ContextMenu>
      <ContextMenuTrigger className={cn(rowActionsView.rowClassName, props.className)}>
        {props.children}
        <div className={rowActionsView.actionBarClassName}>
          <InlineActionButtons inlineActions={props.inlineActions ?? []} onRunAction={rowActionsView.runAction} />
          <ActionsDropdownMenu menuGroups={rowActionsView.menuGroups} onRunAction={rowActionsView.runAction} />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-auto min-w-40">
        <ActionMenuItems menuGroups={rowActionsView.menuGroups} onRunAction={rowActionsView.runAction} />
      </ContextMenuContent>
    </ContextMenu>
  );
};

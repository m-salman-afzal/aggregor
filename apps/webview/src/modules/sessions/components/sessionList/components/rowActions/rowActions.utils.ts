import type {MenuGroup} from "@/modules/sessions/components/sessionList/components/rowActions/rowActions.type.ts";
import type {RowAction} from "@/modules/sessions/sessions.type.ts";

const findSharedRowLabel = (actionGroup: readonly RowAction[]) => {
  const [firstAction] = actionGroup;
  if (firstAction === undefined) return undefined;

  return actionGroup.every((rowAction) => rowAction.sharedRowLabel === firstAction.sharedRowLabel)
    ? firstAction.sharedRowLabel
    : undefined;
};

export const toMenuGroups = (actionGroups: readonly (readonly RowAction[])[]): readonly MenuGroup[] =>
  actionGroups.map((actionGroup) => ({
    groupKey: actionGroup.map((rowAction) => rowAction.commandId).join(" "),
    rowActions: actionGroup,
    sharedRowLabel: findSharedRowLabel(actionGroup)
  }));

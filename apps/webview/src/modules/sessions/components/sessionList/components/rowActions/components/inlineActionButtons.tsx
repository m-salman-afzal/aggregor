import {
  ACTION_BUTTON,
  ACTION_ICON
} from "@/modules/sessions/components/sessionList/components/rowActions/rowActions.constant.ts";
import {Button} from "@pkg/ui/src/components/base/button.tsx";

import type {RowAction} from "@/modules/sessions/sessions.type.ts";

interface InlineActionButtonsProps {
  readonly inlineActions: readonly RowAction[];
  readonly onRunAction: (rowAction: RowAction) => void;
}

export const InlineActionButtons = (props: InlineActionButtonsProps) =>
  props.inlineActions.map((rowAction) => (
    <Button
      aria-label={rowAction.label}
      className={ACTION_BUTTON}
      key={rowAction.commandId}
      onClick={() => {
        props.onRunAction(rowAction);
      }}
      size="icon-xs"
      title={rowAction.label}
      variant="soft">
      <rowAction.icon aria-hidden className={ACTION_ICON} />
    </Button>
  ));

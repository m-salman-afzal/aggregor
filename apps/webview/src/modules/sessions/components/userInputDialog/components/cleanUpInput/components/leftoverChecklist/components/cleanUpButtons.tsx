import {APP_LABELS} from "@pkg/constants/src/app.constant.ts";
import {LEFTOVER_LABELS} from "@pkg/constants/src/git.constant.ts";
import {Button} from "@pkg/ui/src/components/base/button.tsx";

interface CleanUpButtonsProps {
  readonly isDeleteShown: boolean;
  readonly isNothingTicked: boolean;
  readonly onCancel: () => void;
  readonly onDelete: () => void;
}

export const CleanUpButtons = (props: CleanUpButtonsProps) => (
  <div className="flex justify-end gap-2">
    <Button onClick={props.onCancel} size="sm" variant="soft">
      {APP_LABELS.CANCEL}
    </Button>
    {props.isDeleteShown && (
      <Button disabled={props.isNothingTicked} onClick={props.onDelete} size="sm" variant="destructive">
        {LEFTOVER_LABELS.DELETE}
      </Button>
    )}
  </div>
);

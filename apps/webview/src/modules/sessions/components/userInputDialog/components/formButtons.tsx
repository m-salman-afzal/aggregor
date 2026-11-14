import {APP_LABELS} from "@pkg/constants/src/app.constant.ts";
import {Button} from "@pkg/ui/src/components/base/button.tsx";

interface FormButtonsProps {
  readonly onCancel: () => void;
  readonly submitLabel: string;
}

export const FormButtons = (props: FormButtonsProps) => (
  <div className="flex justify-end gap-2">
    <Button onClick={props.onCancel} size="sm" type="button" variant="soft">
      {APP_LABELS.CANCEL}
    </Button>
    <Button size="sm" type="submit">
      {props.submitLabel}
    </Button>
  </div>
);

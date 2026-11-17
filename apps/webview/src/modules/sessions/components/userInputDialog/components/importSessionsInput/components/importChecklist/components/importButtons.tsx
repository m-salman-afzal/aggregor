import {SESSION_IMPORT_LABELS} from "@pkg/constants/src/agentHistory.constant.ts";
import {APP_LABELS} from "@pkg/constants/src/app.constant.ts";
import {Button} from "@pkg/ui/src/components/base/button.tsx";

interface ImportButtonsProps {
  readonly isImportShown: boolean;
  readonly isNothingTicked: boolean;
  readonly onCancel: () => void;
  readonly onImport: () => void;
}

export const ImportButtons = (props: ImportButtonsProps) => (
  <div className="flex justify-end gap-2">
    <Button onClick={props.onCancel} size="sm" variant="soft">
      {APP_LABELS.CANCEL}
    </Button>
    {props.isImportShown && (
      <Button disabled={props.isNothingTicked} onClick={props.onImport} size="sm">
        {SESSION_IMPORT_LABELS.IMPORT}
      </Button>
    )}
  </div>
);

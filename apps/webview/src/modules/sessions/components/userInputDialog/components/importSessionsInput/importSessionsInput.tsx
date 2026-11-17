import {ImportChecklist} from "@/modules/sessions/components/userInputDialog/components/importSessionsInput/components/importChecklist/importChecklist.tsx";
import {SESSION_IMPORT_LABELS} from "@pkg/constants/src/agentHistory.constant.ts";
import {APP_LABELS} from "@pkg/constants/src/app.constant.ts";
import {Button} from "@pkg/ui/src/components/base/button.tsx";
import {DialogDescription} from "@pkg/ui/src/components/base/dialog.tsx";

import type {USER_INPUT_TAGS} from "@/modules/sessions/sessions.constant.ts";
import type {UserInput} from "@/modules/sessions/sessions.type.ts";

interface ImportSessionsInputProps {
  readonly onCancel: () => void;
  readonly userInput: Extract<UserInput, {readonly _tag: typeof USER_INPUT_TAGS.IMPORT_SESSIONS}>;
}

export const ImportSessionsInput = (props: ImportSessionsInputProps) => {
  if (props.userInput.importableSessions !== undefined)
    return <ImportChecklist importableSessions={props.userInput.importableSessions} onCancel={props.onCancel} />;

  return (
    <>
      <DialogDescription className="text-foreground/80">{SESSION_IMPORT_LABELS.CHECKING}</DialogDescription>
      <div className="flex justify-end">
        <Button onClick={props.onCancel} size="sm" variant="soft">
          {APP_LABELS.CANCEL}
        </Button>
      </div>
    </>
  );
};

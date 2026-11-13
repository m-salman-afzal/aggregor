import {ChoiceRow} from "@/modules/sessions/components/userInputDialog/components/choiceRow/choiceRow.tsx";
import {APP_LABELS} from "@pkg/constants/src/app.constant.ts";
import {Button} from "@pkg/ui/src/components/base/button.tsx";

import type {UserInputChoice} from "@/modules/sessions/sessions.type.ts";

interface ChoiceInputProps {
  readonly choices: readonly UserInputChoice[];
  readonly onCancel: () => void;
  readonly onChoose: (choiceId: string, isSecondaryAction: boolean) => void;
}

export const ChoiceInput = (props: ChoiceInputProps) => (
  <>
    <div className="scrollbar-minimal -mr-2 flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
      {props.choices.map((choice) => (
        <ChoiceRow choice={choice} key={choice.choiceId} onChoose={props.onChoose} />
      ))}
    </div>
    <div className="flex justify-end">
      <Button onClick={props.onCancel} size="sm" variant="soft">
        {APP_LABELS.CANCEL}
      </Button>
    </div>
  </>
);

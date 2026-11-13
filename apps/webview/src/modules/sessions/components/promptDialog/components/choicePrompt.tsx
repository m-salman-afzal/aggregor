import {PromptChoiceRow} from "@/modules/sessions/components/promptDialog/components/promptChoiceRow/promptChoiceRow.tsx";
import {APP_LABELS} from "@pkg/constants/src/app.constant.ts";
import {Button} from "@pkg/ui/src/components/base/button.tsx";

import type {WebviewPromptChoice} from "@views/sessions/sessions.view.type.ts";

interface ChoicePromptProps {
  readonly choices: readonly WebviewPromptChoice[];
  readonly onCancel: () => void;
  readonly onChoose: (choiceId: string, isSecondaryAction: boolean) => void;
}

export const ChoicePrompt = (props: ChoicePromptProps) => (
  <>
    <div className="scrollbar-minimal -mr-2 flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
      {props.choices.map((choice) => (
        <PromptChoiceRow choice={choice} key={choice.choiceId} onChoose={props.onChoose} />
      ))}
    </div>
    <div className="flex justify-end">
      <Button onClick={props.onCancel} size="sm" variant="soft">
        {APP_LABELS.CANCEL}
      </Button>
    </div>
  </>
);

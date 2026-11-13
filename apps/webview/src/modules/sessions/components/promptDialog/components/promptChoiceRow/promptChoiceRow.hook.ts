import {SECONDARY_ACTION_ICONS} from "@/modules/sessions/components/promptDialog/components/promptChoiceRow/promptChoiceRow.constant.ts";

import type {WebviewPromptChoice} from "@views/sessions/sessions.view.type.ts";

interface UsePromptChoiceRowProps {
  readonly choice: WebviewPromptChoice;
  readonly onChoose: (choiceId: string, isSecondaryAction: boolean) => void;
}

export const usePromptChoiceRow = (props: UsePromptChoiceRowProps) => ({
  choose: () => {
    props.onChoose(props.choice.choiceId, false);
  },
  chooseSecondaryAction: () => {
    props.onChoose(props.choice.choiceId, true);
  },
  SecondaryActionIcon:
    props.choice.secondaryActionIcon === undefined
      ? undefined
      : SECONDARY_ACTION_ICONS[props.choice.secondaryActionIcon]
});

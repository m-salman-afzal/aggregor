import {useChoiceRow} from "@/modules/sessions/components/userInputDialog/components/choiceRow/choiceRow.hook.ts";
import {ChoiceTexts} from "@/modules/sessions/components/userInputDialog/components/choiceRow/components/choiceTexts.tsx";
import {SecondaryActionButton} from "@/modules/sessions/components/userInputDialog/components/choiceRow/components/secondaryActionButton.tsx";

import type {UserInputChoice} from "@/modules/sessions/sessions.type.ts";

interface ChoiceRowProps {
  readonly choice: UserInputChoice;
  readonly onChoose: (choiceId: string, isSecondaryAction: boolean) => void;
}

export const ChoiceRow = (props: ChoiceRowProps) => {
  const choiceRowView = useChoiceRow(props);

  return (
    <div className="flex min-w-0 items-center rounded-xl bg-level [--level:2] ring-1 ring-hairline transition-[background-color,box-shadow] duration-150 ring-inset hover:[--level:3] hover:ring-brand/45">
      <button
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={choiceRowView.choose}
        type="button">
        {props.choice.iconUri !== undefined && <img alt="" className="size-6 shrink-0" src={props.choice.iconUri} />}
        <ChoiceTexts choice={props.choice} />
      </button>
      {props.choice.secondaryActionLabel !== undefined && (
        <SecondaryActionButton
          Icon={props.choice.SecondaryActionIcon}
          label={props.choice.secondaryActionLabel}
          onClick={choiceRowView.chooseSecondaryAction}
        />
      )}
    </div>
  );
};

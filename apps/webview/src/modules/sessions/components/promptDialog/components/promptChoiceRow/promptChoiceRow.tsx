import {PromptChoiceTexts} from "@/modules/sessions/components/promptDialog/components/promptChoiceRow/components/promptChoiceTexts.tsx";
import {SecondaryActionButton} from "@/modules/sessions/components/promptDialog/components/promptChoiceRow/components/secondaryActionButton.tsx";
import {usePromptChoiceRow} from "@/modules/sessions/components/promptDialog/components/promptChoiceRow/promptChoiceRow.hook.ts";

import type {WebviewPromptChoice} from "@views/sessions/sessions.view.type.ts";

interface PromptChoiceRowProps {
  readonly choice: WebviewPromptChoice;
  readonly onChoose: (choiceId: string, isSecondaryAction: boolean) => void;
}

export const PromptChoiceRow = (props: PromptChoiceRowProps) => {
  const promptChoiceRowView = usePromptChoiceRow(props);

  return (
    <div className="flex min-w-0 items-center rounded-xl bg-level [--level:2] ring-1 ring-hairline transition-[background-color,box-shadow] duration-150 ring-inset hover:[--level:3] hover:ring-brand/45">
      <button
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={promptChoiceRowView.choose}
        type="button">
        {props.choice.iconUri !== undefined && <img alt="" className="size-6 shrink-0" src={props.choice.iconUri} />}
        <PromptChoiceTexts choice={props.choice} />
      </button>
      {props.choice.secondaryActionLabel !== undefined && (
        <SecondaryActionButton
          Icon={promptChoiceRowView.SecondaryActionIcon}
          label={props.choice.secondaryActionLabel}
          onClick={promptChoiceRowView.chooseSecondaryAction}
        />
      )}
    </div>
  );
};

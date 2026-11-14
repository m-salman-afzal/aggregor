import {OptionTexts} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionRow/components/optionTexts.tsx";
import {SecondaryActionButton} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionRow/components/secondaryActionButton.tsx";
import {useOptionRow} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionRow/optionRow.hook.ts";
import {OPTION_ROW} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.constant.ts";

import type {UserInputOption} from "@/modules/sessions/sessions.type.ts";

interface OptionRowProps {
  readonly isChosen: boolean;
  readonly name: string;
  readonly onChoose: (optionId: string) => void;
  readonly onSecondaryAction?: ((optionId: string) => void) | undefined;
  readonly option: UserInputOption;
}

export const OptionRow = (props: OptionRowProps) => {
  const optionRowView = useOptionRow(props);

  return (
    <div className={OPTION_ROW}>
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-2">
        <input
          checked={props.isChosen}
          className="sr-only"
          name={props.name}
          onChange={optionRowView.choose}
          type="radio"
          value={props.option.optionId}
        />
        {props.option.iconUri !== undefined && <img alt="" className="size-6 shrink-0" src={props.option.iconUri} />}
        <OptionTexts option={props.option} />
      </label>
      {props.option.secondaryActionLabel !== undefined && props.onSecondaryAction !== undefined && (
        <SecondaryActionButton
          Icon={props.option.SecondaryActionIcon}
          label={props.option.secondaryActionLabel}
          onClick={optionRowView.runSecondaryAction}
        />
      )}
    </div>
  );
};

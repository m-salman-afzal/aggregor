import {OptionPickerItem} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionPicker/components/optionPickerItem.tsx";
import {OptionPickerLabel} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionPicker/components/optionPickerLabel.tsx";
import {useOptionPicker} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionPicker/optionPicker.hook.ts";
import {OPTION_PICKER_TRIGGER} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.constant.ts";
import {SESSION_LABELS} from "@pkg/constants/src/session.constant.ts";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxList,
  ComboboxTrigger
} from "@pkg/ui/src/components/base/combobox.tsx";

import type {UserInputOption} from "@/modules/sessions/sessions.type.ts";

interface OptionPickerProps {
  readonly chosenOptionId: string;
  readonly legend: string;
  readonly onChoose: (optionId: string) => void;
  readonly onSecondaryAction?: ((optionId: string) => void) | undefined;
  readonly options: readonly UserInputOption[];
}

export const OptionPicker = (props: OptionPickerProps) => {
  const optionPickerView = useOptionPicker(props);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground-strong">{props.legend}</span>
      <Combobox
        isItemEqualToValue={optionPickerView.isSameOption}
        items={props.options}
        itemToStringLabel={optionPickerView.readOptionLabel}
        itemToStringValue={optionPickerView.readOptionValue}
        onValueChange={optionPickerView.chooseOption}
        value={optionPickerView.chosenOption}>
        <ComboboxTrigger aria-label={props.legend} className={OPTION_PICKER_TRIGGER}>
          {optionPickerView.chosenOption !== null && <OptionPickerLabel option={optionPickerView.chosenOption} />}
        </ComboboxTrigger>
        <ComboboxContent>
          <ComboboxInput placeholder={SESSION_LABELS.SEARCH} showTrigger={false} />
          <ComboboxEmpty>{SESSION_LABELS.NO_MATCHES}</ComboboxEmpty>
          <ComboboxList>
            {(option: UserInputOption) => (
              <OptionPickerItem key={option.optionId} onSecondaryAction={props.onSecondaryAction} option={option} />
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
};

import {OptionPickerLabel} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionPicker/components/optionPickerLabel.tsx";
import {OptionPickerPopup} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionPicker/components/optionPickerPopup.tsx";
import {useOptionPicker} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionPicker/optionPicker.hook.ts";
import {OPTION_PICKER_TRIGGER} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.constant.ts";
import {Combobox, ComboboxTrigger} from "@pkg/ui/src/components/base/combobox.tsx";

import type {NewSessionOptionTab} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.type.ts";
import type {UserInputOption} from "@/modules/sessions/sessions.type.ts";

interface OptionPickerProps {
  readonly chosenOptionId: string;
  readonly legend: string;
  readonly onChoose: (optionId: string) => void;
  readonly onSecondaryAction?: ((optionId: string) => void) | undefined;
  readonly options: readonly UserInputOption[];
  readonly optionTabs?: readonly NewSessionOptionTab[] | undefined;
}

export const OptionPicker = (props: OptionPickerProps) => {
  const optionPickerView = useOptionPicker(props);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground-strong">{props.legend}</span>
      <Combobox
        isItemEqualToValue={optionPickerView.isSameOption}
        items={optionPickerView.shownOptions}
        itemToStringLabel={optionPickerView.readOptionLabel}
        itemToStringValue={optionPickerView.readOptionValue}
        onValueChange={optionPickerView.chooseOption}
        value={optionPickerView.chosenOption}>
        <ComboboxTrigger aria-label={props.legend} className={OPTION_PICKER_TRIGGER}>
          {optionPickerView.chosenOption !== null && <OptionPickerLabel option={optionPickerView.chosenOption} />}
        </ComboboxTrigger>
        <OptionPickerPopup
          onSecondaryAction={props.onSecondaryAction}
          onShowTab={optionPickerView.showTab}
          optionTabs={props.optionTabs}
          shownTabLabel={optionPickerView.shownTabLabel}
        />
      </Combobox>
    </div>
  );
};

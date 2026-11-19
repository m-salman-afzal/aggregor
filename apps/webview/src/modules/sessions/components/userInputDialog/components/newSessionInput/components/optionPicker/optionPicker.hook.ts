import {
  findChosenTabLabel,
  isSameOption,
  readOptionLabel,
  readOptionValue
} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionPicker/optionPicker.utils.ts";
import {useState} from "react";

import type {NewSessionOptionTab} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.type.ts";
import type {UserInputOption} from "@/modules/sessions/sessions.type.ts";

interface UseOptionPickerProps {
  readonly chosenOptionId: string;
  readonly onChoose: (optionId: string) => void;
  readonly options: readonly UserInputOption[];
  readonly optionTabs?: readonly NewSessionOptionTab[] | undefined;
}

export const useOptionPicker = (props: UseOptionPickerProps) => {
  const [shownTabLabel, setShownTabLabel] = useState(() => findChosenTabLabel(props.optionTabs, props.chosenOptionId));
  const shownTab = props.optionTabs?.find((optionTab) => optionTab.label === shownTabLabel);
  const chooseOption = (chosenOption: null | UserInputOption) => {
    if (chosenOption !== null) props.onChoose(chosenOption.optionId);
  };

  return {
    chooseOption,
    chosenOption: props.options.find((option) => option.optionId === props.chosenOptionId) ?? null,
    isSameOption,
    readOptionLabel,
    readOptionValue,
    shownOptions: shownTab === undefined ? props.options : shownTab.options,
    shownTabLabel,
    showTab: setShownTabLabel
  };
};

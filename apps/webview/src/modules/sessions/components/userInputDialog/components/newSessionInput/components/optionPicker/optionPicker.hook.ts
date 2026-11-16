import type {UserInputOption} from "@/modules/sessions/sessions.type.ts";

interface UseOptionPickerProps {
  readonly chosenOptionId: string;
  readonly onChoose: (optionId: string) => void;
  readonly options: readonly UserInputOption[];
}

export const useOptionPicker = (props: UseOptionPickerProps) => ({
  chooseOption: (chosenOption: null | UserInputOption) => {
    if (chosenOption !== null) props.onChoose(chosenOption.optionId);
  },
  chosenOption: props.options.find((option) => option.optionId === props.chosenOptionId) ?? null,
  isSameOption: (option: UserInputOption, otherOption: UserInputOption) => option.optionId === otherOption.optionId,
  readOptionLabel: (option: UserInputOption) => option.label,
  readOptionValue: (option: UserInputOption) => option.optionId
});

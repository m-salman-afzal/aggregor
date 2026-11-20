import type {NewSessionOptionTab} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.type.ts";
import type {UserInputOption} from "@/modules/sessions/sessions.type.ts";

export const findChosenTabLabel = (optionTabs: readonly NewSessionOptionTab[] | undefined, chosenOptionId: string) => {
  const chosenTab = optionTabs?.find((optionTab) =>
    optionTab.options.some((option) => option.optionId === chosenOptionId)
  );

  return (chosenTab ?? optionTabs?.[0])?.label ?? "";
};

export const isSameOption = (option: UserInputOption, otherOption: UserInputOption) =>
  option.optionId === otherOption.optionId;

export const readOptionLabel = (option: UserInputOption) => option.label;

export const readOptionValue = (option: UserInputOption) => option.optionId;

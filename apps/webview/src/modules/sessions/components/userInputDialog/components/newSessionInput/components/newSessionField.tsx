import {OptionGroup} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionGroup.tsx";
import {OptionPicker} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionPicker/optionPicker.tsx";

import type {NewSessionOptionGroup} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.type.ts";

interface NewSessionFieldProps {
  readonly optionGroup: NewSessionOptionGroup;
}

export const NewSessionField = (props: NewSessionFieldProps) => {
  if (props.optionGroup.isDropdown)
    return (
      <OptionPicker
        chosenOptionId={props.optionGroup.chosenOptionId}
        legend={props.optionGroup.legend}
        onChoose={props.optionGroup.onChoose}
        onSecondaryAction={props.optionGroup.onSecondaryAction}
        options={props.optionGroup.options}
        optionTabs={props.optionGroup.optionTabs}
      />
    );

  return (
    <OptionGroup
      chosenOptionId={props.optionGroup.chosenOptionId}
      legend={props.optionGroup.legend}
      name={props.optionGroup.name}
      onChoose={props.optionGroup.onChoose}
      onSecondaryAction={props.optionGroup.onSecondaryAction}
      options={props.optionGroup.options}
    />
  );
};

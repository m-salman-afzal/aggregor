import {OptionPickerLabel} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionPicker/components/optionPickerLabel.tsx";
import {SecondaryActionButton} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/secondaryActionButton.tsx";
import {ComboboxItem} from "@pkg/ui/src/components/base/combobox.tsx";

import type {MouseEvent} from "react";

import type {UserInputOption} from "@/modules/sessions/sessions.type.ts";

interface OptionPickerItemProps {
  readonly onSecondaryAction?: ((optionId: string) => void) | undefined;
  readonly option: UserInputOption;
}

export const OptionPickerItem = (props: OptionPickerItemProps) => (
  <ComboboxItem value={props.option}>
    <OptionPickerLabel option={props.option} />
    {props.option.secondaryActionLabel !== undefined && props.onSecondaryAction !== undefined && (
      <SecondaryActionButton
        Icon={props.option.SecondaryActionIcon}
        label={props.option.secondaryActionLabel}
        onClick={(clickEvent: MouseEvent) => {
          clickEvent.stopPropagation();
          props.onSecondaryAction?.(props.option.optionId);
        }}
      />
    )}
  </ComboboxItem>
);

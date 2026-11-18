import {OptionPickerItem} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionPicker/components/optionPickerItem.tsx";
import {OptionPickerTabs} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionPicker/components/optionPickerTabs.tsx";
import {SESSION_LABELS} from "@pkg/constants/src/session.constant.ts";
import {ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxList} from "@pkg/ui/src/components/base/combobox.tsx";

import type {NewSessionOptionTab} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.type.ts";
import type {UserInputOption} from "@/modules/sessions/sessions.type.ts";

interface OptionPickerPopupProps {
  readonly onSecondaryAction?: ((optionId: string) => void) | undefined;
  readonly onShowTab: (tabLabel: string) => void;
  readonly optionTabs?: readonly NewSessionOptionTab[] | undefined;
  readonly shownTabLabel: string;
}

export const OptionPickerPopup = (props: OptionPickerPopupProps) => (
  <ComboboxContent>
    <ComboboxInput placeholder={SESSION_LABELS.SEARCH} showTrigger={false} />
    {props.optionTabs !== undefined && (
      <OptionPickerTabs onShowTab={props.onShowTab} optionTabs={props.optionTabs} shownTabLabel={props.shownTabLabel} />
    )}
    <ComboboxEmpty>{SESSION_LABELS.NO_MATCHES}</ComboboxEmpty>
    <ComboboxList>
      {(option: UserInputOption) => (
        <OptionPickerItem key={option.optionId} onSecondaryAction={props.onSecondaryAction} option={option} />
      )}
    </ComboboxList>
  </ComboboxContent>
);

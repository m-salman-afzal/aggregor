import {OptionTexts} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionTexts.tsx";

import type {UserInputOption} from "@/modules/sessions/sessions.type.ts";

interface OptionPickerLabelProps {
  readonly option: UserInputOption;
}

export const OptionPickerLabel = (props: OptionPickerLabelProps) => (
  <span className="flex min-w-0 flex-1 items-center gap-3">
    {props.option.iconUri !== undefined && <img alt="" className="size-6 shrink-0" src={props.option.iconUri} />}
    <OptionTexts option={props.option} />
  </span>
);

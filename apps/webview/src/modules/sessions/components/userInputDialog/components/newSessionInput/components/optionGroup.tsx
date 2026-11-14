import {OptionRow} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionRow/optionRow.tsx";

import type {UserInputOption} from "@/modules/sessions/sessions.type.ts";

interface OptionGroupProps {
  readonly chosenOptionId: string;
  readonly legend: string;
  readonly name: string;
  readonly onChoose: (optionId: string) => void;
  readonly onSecondaryAction?: ((optionId: string) => void) | undefined;
  readonly options: readonly UserInputOption[];
}

export const OptionGroup = (props: OptionGroupProps) => (
  <fieldset className="flex min-w-0 flex-col gap-1.5">
    <legend className="mb-1.5 text-xs font-medium text-foreground-strong">{props.legend}</legend>
    {props.options.map((option) => (
      <OptionRow
        isChosen={option.optionId === props.chosenOptionId}
        key={option.optionId}
        name={props.name}
        onChoose={props.onChoose}
        onSecondaryAction={props.onSecondaryAction}
        option={option}
      />
    ))}
  </fieldset>
);

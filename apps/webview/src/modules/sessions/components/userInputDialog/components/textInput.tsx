import {FormButtons} from "@/modules/sessions/components/userInputDialog/components/formButtons.tsx";
import {SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";
import {Input} from "@pkg/ui/src/components/base/input.tsx";

import type {SubmitEvent} from "react";

interface TextInputProps {
  readonly onCancel: () => void;
  readonly onEnterText: (formEvent: SubmitEvent<HTMLFormElement>) => void;
  readonly value: string;
}

// The input comes first, so it takes the focus, with its text selected so typing replaces it.
export const TextInput = (props: TextInputProps) => (
  <form className="flex flex-col gap-4" onSubmit={props.onEnterText}>
    <Input
      defaultValue={props.value}
      name={SESSIONS_LABELS.USER_INPUT_TEXT_FIELD}
      onFocus={(focusEvent) => {
        focusEvent.currentTarget.select();
      }}
    />
    <FormButtons onCancel={props.onCancel} submitLabel={SESSIONS_LABELS.OK} />
  </form>
);

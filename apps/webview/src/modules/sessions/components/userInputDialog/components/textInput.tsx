import {SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";
import {APP_LABELS} from "@pkg/constants/src/app.constant.ts";
import {Button} from "@pkg/ui/src/components/base/button.tsx";
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
    <div className="flex justify-end gap-2">
      <Button onClick={props.onCancel} size="sm" type="button" variant="soft">
        {APP_LABELS.CANCEL}
      </Button>
      <Button size="sm" type="submit">
        {SESSIONS_LABELS.OK}
      </Button>
    </div>
  </form>
);

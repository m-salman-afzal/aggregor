import {APP_LABELS} from "@pkg/constants/src/app.constant.ts";
import {Button} from "@pkg/ui/src/components/base/button.tsx";
import {DialogDescription} from "@pkg/ui/src/components/base/dialog.tsx";

import type {UserInputAnswer} from "@/modules/sessions/sessions.type.ts";

interface QuestionInputProps {
  readonly answers: readonly UserInputAnswer[];
  readonly onCancel: () => void;
  readonly onChoose: (answerId: string, isSecondaryAction: boolean) => void;
}

// Cancel comes first, so it takes the focus.
export const QuestionInput = (props: QuestionInputProps) => (
  <>
    <DialogDescription className="flex flex-col gap-1 text-pretty text-foreground/80">
      {props.answers.map((answer) => (
        <span key={answer.answerId}>{answer.consequence}</span>
      ))}
    </DialogDescription>
    <div className="flex flex-wrap justify-end gap-2">
      <Button onClick={props.onCancel} size="sm" variant="soft">
        {APP_LABELS.CANCEL}
      </Button>
      {props.answers.map((answer) => (
        <Button
          key={answer.answerId}
          onClick={() => {
            props.onChoose(answer.answerId, false);
          }}
          size="sm"
          variant={answer.isDestructive ? "destructive" : "default"}>
          {answer.label}
        </Button>
      ))}
    </div>
  </>
);

import {APP_LABELS} from "@pkg/constants/src/app.constant.ts";
import {Button} from "@pkg/ui/src/components/base/button.tsx";
import {DialogDescription} from "@pkg/ui/src/components/base/dialog.tsx";

import type {PROMPT_TAGS} from "@pkg/constants/src/sessionsView.constant.ts";
import type {WebviewPrompt} from "@views/sessions/sessions.view.type.ts";

interface QuestionPromptProps {
  readonly answers: Extract<WebviewPrompt, {readonly _tag: typeof PROMPT_TAGS.QUESTION}>["answers"];
  readonly onCancel: () => void;
  readonly onChoose: (answerId: string, isSecondaryAction: boolean) => void;
}

// Cancel comes first, so it takes the focus.
export const QuestionPrompt = (props: QuestionPromptProps) => (
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

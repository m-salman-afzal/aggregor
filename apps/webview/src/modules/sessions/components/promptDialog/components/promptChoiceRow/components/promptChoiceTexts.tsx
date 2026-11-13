import type {WebviewPromptChoice} from "@views/sessions/sessions.view.type.ts";

interface PromptChoiceTextsProps {
  readonly choice: WebviewPromptChoice;
}

export const PromptChoiceTexts = (props: PromptChoiceTextsProps) => (
  <span className="flex min-w-0 flex-col gap-0.5">
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate font-medium text-foreground-strong">{props.choice.label}</span>
      {props.choice.badge !== undefined && (
        <span className="shrink-0 rounded-full bg-brand-end/18 px-1.5 py-px text-[0.6875rem] font-medium text-brand-end">
          {props.choice.badge}
        </span>
      )}
    </span>
    {props.choice.description !== undefined && (
      <span className="truncate text-xs text-muted-foreground">{props.choice.description}</span>
    )}
    {props.choice.detail !== undefined && (
      <span className="text-xs text-pretty text-muted-foreground">{props.choice.detail}</span>
    )}
  </span>
);

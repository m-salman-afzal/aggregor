import type {UserInputOption} from "@/modules/sessions/sessions.type.ts";

interface OptionTextsProps {
  readonly option: UserInputOption;
}

export const OptionTexts = (props: OptionTextsProps) => (
  <span className="flex min-w-0 flex-col gap-0.5">
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate font-medium text-foreground-strong">{props.option.label}</span>
      {props.option.badge !== undefined && (
        <span className="shrink-0 rounded-full bg-brand-end/18 px-1.5 py-px text-[0.6875rem] font-medium text-brand-end">
          {props.option.badge}
        </span>
      )}
    </span>
    {props.option.description !== undefined && (
      <span className="truncate text-xs text-muted-foreground">{props.option.description}</span>
    )}
  </span>
);

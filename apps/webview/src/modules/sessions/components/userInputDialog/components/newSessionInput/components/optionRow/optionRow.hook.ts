import type {UserInputOption} from "@/modules/sessions/sessions.type.ts";

interface UseOptionRowProps {
  readonly onChoose: (optionId: string) => void;
  readonly onSecondaryAction?: ((optionId: string) => void) | undefined;
  readonly option: UserInputOption;
}

export const useOptionRow = (props: UseOptionRowProps) => ({
  choose: () => {
    props.onChoose(props.option.optionId);
  },
  runSecondaryAction: () => {
    props.onSecondaryAction?.(props.option.optionId);
  }
});

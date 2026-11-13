import type {UserInputChoice} from "@/modules/sessions/sessions.type.ts";

interface UseChoiceRowProps {
  readonly choice: UserInputChoice;
  readonly onChoose: (choiceId: string, isSecondaryAction: boolean) => void;
}

export const useChoiceRow = (props: UseChoiceRowProps) => ({
  choose: () => {
    props.onChoose(props.choice.choiceId, false);
  },
  chooseSecondaryAction: () => {
    props.onChoose(props.choice.choiceId, true);
  }
});

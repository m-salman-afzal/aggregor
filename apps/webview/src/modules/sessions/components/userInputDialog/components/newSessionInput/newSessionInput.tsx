import {FormButtons} from "@/modules/sessions/components/userInputDialog/components/formButtons.tsx";
import {OptionGroup} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionGroup.tsx";
import {useNewSessionInput} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.hook.ts";
import {SESSION_LABELS} from "@pkg/constants/src/session.constant.ts";

import type {CommandRequest} from "@views/sessions/sessions.view.type.ts";

interface NewSessionInputProps {
  readonly chosenProjectPath?: string | undefined;
  readonly onCancel: () => void;
  readonly onStart: (newSessionRequest: CommandRequest) => void;
}

// Every choice shows at once, each with its default chosen, so Start alone starts the usual session.
export const NewSessionInput = (props: NewSessionInputProps) => {
  const newSessionView = useNewSessionInput(props);

  return (
    <form className="flex flex-col gap-4" onSubmit={newSessionView.start}>
      <div className="scrollbar-minimal -mr-2 flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-2">
        {newSessionView.optionGroups.map((optionGroup) => (
          <OptionGroup
            chosenOptionId={optionGroup.chosenOptionId}
            key={optionGroup.name}
            legend={optionGroup.legend}
            name={optionGroup.name}
            onChoose={optionGroup.onChoose}
            onSecondaryAction={optionGroup.onSecondaryAction}
            options={optionGroup.options}
          />
        ))}
      </div>
      <FormButtons onCancel={props.onCancel} submitLabel={SESSION_LABELS.START} />
    </form>
  );
};

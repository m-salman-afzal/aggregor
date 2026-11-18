import {FormButtons} from "@/modules/sessions/components/userInputDialog/components/formButtons.tsx";
import {NewSessionField} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/newSessionField.tsx";
import {WorktreeTrustHint} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/worktreeTrustHint/worktreeTrustHint.tsx";
import {useWorkingTreeInput} from "@/modules/sessions/components/userInputDialog/components/workingTreeInput/workingTreeInput.hook.ts";
import {SESSION_LABELS} from "@pkg/constants/src/session.constant.ts";

import type {USER_INPUT_TAGS} from "@/modules/sessions/sessions.constant.ts";
import type {UserInput} from "@/modules/sessions/sessions.type.ts";

interface WorkingTreeInputProps {
  readonly onCancel: () => void;
  readonly userInput: Extract<UserInput, {readonly _tag: typeof USER_INPUT_TAGS.WORKING_TREE}>;
}

export const WorkingTreeInput = (props: WorkingTreeInputProps) => {
  const workingTreeView = useWorkingTreeInput(props);

  return (
    <form className="flex flex-col gap-4" onSubmit={workingTreeView.move}>
      <div className="scrollbar-minimal -mr-2 flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-2">
        {workingTreeView.optionGroups.map((optionGroup) => (
          <NewSessionField key={optionGroup.name} optionGroup={optionGroup} />
        ))}
      </div>
      {workingTreeView.newWorktreesRootPath !== undefined && (
        <WorktreeTrustHint folderPath={workingTreeView.newWorktreesRootPath} />
      )}
      <FormButtons onCancel={props.onCancel} submitLabel={SESSION_LABELS.MOVE} />
    </form>
  );
};

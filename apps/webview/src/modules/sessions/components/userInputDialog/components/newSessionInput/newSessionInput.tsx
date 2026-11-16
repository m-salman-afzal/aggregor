import {FormButtons} from "@/modules/sessions/components/userInputDialog/components/formButtons.tsx";
import {NewSessionField} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/newSessionField.tsx";
import {WorktreeTrustHint} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/worktreeTrustHint/worktreeTrustHint.tsx";
import {useNewSessionInput} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.hook.ts";
import {SESSION_LABELS} from "@pkg/constants/src/session.constant.ts";

import type {ProjectBranchesDto} from "@dtos/worktree.dto.ts";
import type {CommandRequest} from "@views/sessions/sessions.view.type.ts";

interface NewSessionInputProps {
  readonly branches: ProjectBranchesDto | undefined;
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
          <NewSessionField key={optionGroup.name} optionGroup={optionGroup} />
        ))}
      </div>
      {newSessionView.newWorktreesRootPath !== undefined && (
        <WorktreeTrustHint folderPath={newSessionView.newWorktreesRootPath} />
      )}
      <FormButtons onCancel={props.onCancel} submitLabel={SESSION_LABELS.START} />
    </form>
  );
};

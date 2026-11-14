import {WorkingTreeOption} from "@/modules/sessions/components/userInputDialog/components/projectSettingsInput/components/workingTreeOption.tsx";
import {
  SETTINGS_FIELD,
  SETTINGS_LABEL
} from "@/modules/sessions/components/userInputDialog/components/projectSettingsInput/projectSettingsInput.constant.ts";
import {SESSION_WORKING_TREES} from "@/modules/sessions/components/userInputDialog/userInputDialog.constant.ts";
import {PROJECT_SETTINGS_LABELS} from "@pkg/constants/src/project.constant.ts";

interface WorkingTreeFieldProps {
  readonly newSessionWorkingTree: string;
}

export const WorkingTreeField = (props: WorkingTreeFieldProps) => (
  <fieldset className={SETTINGS_FIELD}>
    <legend className={SETTINGS_LABEL}>{PROJECT_SETTINGS_LABELS.NEW_SESSION_WORKING_TREE}</legend>
    <div className="mt-1.5 flex gap-1.5">
      <WorkingTreeOption
        isChosen={props.newSessionWorkingTree === SESSION_WORKING_TREES.PROJECT_ROOT}
        label={PROJECT_SETTINGS_LABELS.WORKING_TREE_PROJECT_ROOT}
        workingTree={SESSION_WORKING_TREES.PROJECT_ROOT}
      />
      <WorkingTreeOption
        isChosen={props.newSessionWorkingTree === SESSION_WORKING_TREES.WORKTREE}
        label={PROJECT_SETTINGS_LABELS.WORKING_TREE_WORKTREE}
        workingTree={SESSION_WORKING_TREES.WORKTREE}
      />
    </div>
  </fieldset>
);

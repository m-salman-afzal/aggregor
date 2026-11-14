import {WORKING_TREE_OPTION} from "@/modules/sessions/components/userInputDialog/components/projectSettingsInput/projectSettingsInput.constant.ts";
import {PROJECT_SETTINGS_FIELDS} from "@/modules/sessions/components/userInputDialog/userInputDialog.constant.ts";

interface WorkingTreeOptionProps {
  readonly isChosen: boolean;
  readonly label: string;
  readonly workingTree: string;
}

export const WorkingTreeOption = (props: WorkingTreeOptionProps) => (
  <label className={WORKING_TREE_OPTION}>
    <input
      className="sr-only"
      defaultChecked={props.isChosen}
      name={PROJECT_SETTINGS_FIELDS.NEW_SESSION_WORKING_TREE}
      type="radio"
      value={props.workingTree}
    />
    {props.label}
  </label>
);

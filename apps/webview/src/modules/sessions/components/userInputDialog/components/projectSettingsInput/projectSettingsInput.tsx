import {FormButtons} from "@/modules/sessions/components/userInputDialog/components/formButtons.tsx";
import {SettingsTextField} from "@/modules/sessions/components/userInputDialog/components/projectSettingsInput/components/settingsTextField.tsx";
import {WorkingTreeField} from "@/modules/sessions/components/userInputDialog/components/projectSettingsInput/components/workingTreeField.tsx";
import {PROJECT_SETTINGS_FIELDS} from "@/modules/sessions/components/userInputDialog/userInputDialog.constant.ts";
import {PROJECT_SETTINGS_LABELS} from "@pkg/constants/src/project.constant.ts";

import type {ProjectSettingsDto} from "@dtos/project.dto.ts";
import type {SubmitEvent} from "react";

interface ProjectSettingsInputProps {
  readonly onCancel: () => void;
  readonly onSave: (formEvent: SubmitEvent<HTMLFormElement>) => void;
  readonly settings: ProjectSettingsDto;
}

export const ProjectSettingsInput = (props: ProjectSettingsInputProps) => (
  <form className="flex flex-col gap-4" onSubmit={props.onSave}>
    <WorkingTreeField newSessionWorkingTree={props.settings.newSessionWorkingTree} />
    <SettingsTextField
      label={PROJECT_SETTINGS_LABELS.WORKTREE_FOLDER}
      name={PROJECT_SETTINGS_FIELDS.WORKTREE_FOLDER}
      placeholder={PROJECT_SETTINGS_LABELS.WORKTREE_FOLDER_PLACEHOLDER}
      value={props.settings.worktreeFolder}
    />
    <SettingsTextField
      hint={PROJECT_SETTINGS_LABELS.FILES_TO_COPY_HINT}
      label={PROJECT_SETTINGS_LABELS.FILES_TO_COPY}
      name={PROJECT_SETTINGS_FIELDS.FILES_TO_COPY}
      value={props.settings.filesToCopy.join(", ")}
    />
    <SettingsTextField
      hint={PROJECT_SETTINGS_LABELS.SETUP_SCRIPT_HINT}
      label={PROJECT_SETTINGS_LABELS.SETUP_SCRIPT}
      name={PROJECT_SETTINGS_FIELDS.SETUP_SCRIPT}
      value={props.settings.setupScript}
    />
    <FormButtons onCancel={props.onCancel} submitLabel={PROJECT_SETTINGS_LABELS.SAVE} />
  </form>
);

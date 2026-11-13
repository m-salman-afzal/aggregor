import {
  SETTINGS_FIELD,
  SETTINGS_HINT,
  SETTINGS_LABEL
} from "@/modules/sessions/components/userInputDialog/components/projectSettingsInput/projectSettingsInput.constant.ts";
import {Input} from "@pkg/ui/src/components/base/input.tsx";

interface SettingsTextFieldProps {
  readonly hint?: string | undefined;
  readonly label: string;
  readonly name: string;
  readonly placeholder?: string | undefined;
  readonly value: string;
}

export const SettingsTextField = (props: SettingsTextFieldProps) => (
  <label className={SETTINGS_FIELD}>
    <span className={SETTINGS_LABEL}>{props.label}</span>
    <Input defaultValue={props.value} name={props.name} placeholder={props.placeholder} />
    {props.hint !== undefined && <span className={SETTINGS_HINT}>{props.hint}</span>}
  </label>
);

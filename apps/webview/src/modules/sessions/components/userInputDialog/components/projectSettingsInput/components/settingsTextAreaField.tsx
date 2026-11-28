import {
  SETTINGS_FIELD,
  SETTINGS_HINT,
  SETTINGS_LABEL
} from "@/modules/sessions/components/userInputDialog/components/projectSettingsInput/projectSettingsInput.constant.ts";
import {Textarea} from "@pkg/ui/src/components/base/textarea.tsx";

interface SettingsTextAreaFieldProps {
  readonly hint: string;
  readonly label: string;
  readonly name: string;
  readonly value: string;
}

export const SettingsTextAreaField = (props: SettingsTextAreaFieldProps) => (
  <label className={SETTINGS_FIELD}>
    <span className={SETTINGS_LABEL}>{props.label}</span>
    <Textarea
      className="bg-lift-1 text-sm hover:bg-lift-2 focus-visible:bg-lift-1"
      defaultValue={props.value}
      name={props.name}
    />
    <span className={SETTINGS_HINT}>{props.hint}</span>
  </label>
);

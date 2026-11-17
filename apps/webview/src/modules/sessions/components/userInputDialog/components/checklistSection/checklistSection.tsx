import type {ChecklistRowData} from "@/modules/sessions/components/userInputDialog/components/checklistSection/checklistSection.type.ts";

interface ChecklistSectionProps {
  readonly checklistRows: readonly ChecklistRowData[];
  readonly legend: string;
  readonly onToggleRow: (rowKey: string) => void;
  readonly tickedRowKeys: ReadonlySet<string>;
}

export const ChecklistSection = (props: ChecklistSectionProps) =>
  props.checklistRows.length > 0 && (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="mb-1 text-xs font-medium text-foreground-strong">{props.legend}</legend>
      {props.checklistRows.map((checklistRow) => (
        <label
          className="flex min-w-0 items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-lift-1 has-disabled:opacity-60"
          key={checklistRow.rowKey}>
          <input
            checked={props.tickedRowKeys.has(checklistRow.rowKey)}
            className="mt-0.5 accent-primary"
            disabled={checklistRow.isDisabled}
            onChange={() => {
              props.onToggleRow(checklistRow.rowKey);
            }}
            type="checkbox"
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-foreground">{checklistRow.label}</span>
            <span className="truncate text-xs text-muted-foreground">{checklistRow.detail}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );

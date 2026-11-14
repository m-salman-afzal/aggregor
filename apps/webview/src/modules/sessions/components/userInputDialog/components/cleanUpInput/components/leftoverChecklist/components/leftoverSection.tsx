import type {LeftoverRowData} from "@/modules/sessions/components/userInputDialog/components/cleanUpInput/components/leftoverChecklist/leftoverChecklist.type.ts";

interface LeftoverSectionProps {
  readonly leftoverRows: readonly LeftoverRowData[];
  readonly legend: string;
  readonly onToggleRow: (rowKey: string) => void;
  readonly tickedRowKeys: ReadonlySet<string>;
}

export const LeftoverSection = (props: LeftoverSectionProps) =>
  props.leftoverRows.length > 0 && (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="mb-1 text-xs font-medium text-foreground-strong">{props.legend}</legend>
      {props.leftoverRows.map((leftoverRow) => (
        <label
          className="flex min-w-0 items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-lift-1 has-disabled:opacity-60"
          key={leftoverRow.rowKey}>
          <input
            checked={props.tickedRowKeys.has(leftoverRow.rowKey)}
            className="mt-0.5 accent-primary"
            disabled={leftoverRow.isDisabled}
            onChange={() => {
              props.onToggleRow(leftoverRow.rowKey);
            }}
            type="checkbox"
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-foreground">{leftoverRow.label}</span>
            <span className="truncate text-xs text-muted-foreground">{leftoverRow.detail}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );

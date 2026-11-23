import {ChecklistSection} from "@/modules/sessions/components/userInputDialog/components/checklistSection/checklistSection.tsx";
import {SESSION_IMPORT_LABELS} from "@pkg/constants/src/agentHistory.constant.ts";
import {Checkbox} from "@pkg/ui/src/components/base/checkbox.tsx";
import {Input} from "@pkg/ui/src/components/base/input.tsx";

import type {ImportChecklistSection} from "@/modules/sessions/components/userInputDialog/components/importSessionsInput/components/importChecklist/importChecklist.type.ts";

interface ImportListProps {
  readonly areAllShownTicked: boolean;
  readonly onChangeSearchText: (searchText: string) => void;
  readonly onToggleAll: () => void;
  readonly onToggleRow: (rowKey: string) => void;
  readonly searchText: string;
  readonly shownChecklistSections: readonly ImportChecklistSection[];
  readonly tickedRowKeys: ReadonlySet<string>;
}

export const ImportList = (props: ImportListProps) => (
  <div className="flex min-w-0 flex-col gap-3">
    <Input
      onChange={(changeEvent) => {
        props.onChangeSearchText(changeEvent.currentTarget.value);
      }}
      placeholder={SESSION_IMPORT_LABELS.SEARCH_PLACEHOLDER}
      value={props.searchText}
    />
    {props.shownChecklistSections.length === 0 ? (
      <p className="px-2 text-sm text-muted-foreground">{SESSION_IMPORT_LABELS.NO_MATCH}</p>
    ) : (
      <div className="-mr-2 scrollbar-minimal flex max-h-80 min-w-0 flex-col gap-3 overflow-y-auto pr-2">
        <label className="flex items-center gap-2 px-2 text-xs font-medium text-foreground-strong">
          <Checkbox checked={props.areAllShownTicked} onCheckedChange={props.onToggleAll} />
          {SESSION_IMPORT_LABELS.SELECT_ALL}
        </label>
        {props.shownChecklistSections.map((shownChecklistSection) => (
          <ChecklistSection
            checklistRows={shownChecklistSection.checklistRows}
            key={shownChecklistSection.legend}
            legend={shownChecklistSection.legend}
            onToggleRow={props.onToggleRow}
            tickedRowKeys={props.tickedRowKeys}
          />
        ))}
      </div>
    )}
  </div>
);

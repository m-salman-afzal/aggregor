import {ChecklistSection} from "@/modules/sessions/components/userInputDialog/components/checklistSection/checklistSection.tsx";
import {SESSION_IMPORT_LABELS} from "@pkg/constants/src/agentHistory.constant.ts";

import type {AgentChecklistGroup} from "@/modules/sessions/components/userInputDialog/components/importSessionsInput/components/importChecklist/importChecklist.type.ts";

interface ImportListProps {
  readonly agentChecklistGroups: readonly AgentChecklistGroup[];
  readonly areAllTicked: boolean;
  readonly onToggleAll: () => void;
  readonly onToggleRow: (rowKey: string) => void;
  readonly tickedRowKeys: ReadonlySet<string>;
}

export const ImportList = (props: ImportListProps) => (
  <div className="scrollbar-minimal -mr-2 flex max-h-80 min-w-0 flex-col gap-3 overflow-y-auto pr-2">
    <label className="flex items-center gap-2 px-2 text-xs font-medium text-foreground-strong">
      <input checked={props.areAllTicked} className="accent-primary" onChange={props.onToggleAll} type="checkbox" />
      {SESSION_IMPORT_LABELS.SELECT_ALL}
    </label>
    {props.agentChecklistGroups.map((agentChecklistGroup) => (
      <ChecklistSection
        checklistRows={agentChecklistGroup.checklistRows}
        key={agentChecklistGroup.agentName}
        legend={agentChecklistGroup.agentName}
        onToggleRow={props.onToggleRow}
        tickedRowKeys={props.tickedRowKeys}
      />
    ))}
  </div>
);

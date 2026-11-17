import {ChecklistSection} from "@/modules/sessions/components/userInputDialog/components/checklistSection/checklistSection.tsx";
import {LEFTOVER_LABELS} from "@pkg/constants/src/git.constant.ts";

import type {LeftoverRowData} from "@/modules/sessions/components/userInputDialog/components/cleanUpInput/components/leftoverChecklist/leftoverChecklist.type.ts";

interface LeftoverListProps {
  readonly areAllTicked: boolean;
  readonly branchRows: readonly LeftoverRowData[];
  readonly onToggleAll: () => void;
  readonly onToggleRow: (rowKey: string) => void;
  readonly tickedRowKeys: ReadonlySet<string>;
  readonly worktreeRows: readonly LeftoverRowData[];
}

export const LeftoverList = (props: LeftoverListProps) => (
  <div className="scrollbar-minimal -mr-2 flex max-h-80 min-w-0 flex-col gap-3 overflow-y-auto pr-2">
    <label className="flex items-center gap-2 px-2 text-xs font-medium text-foreground-strong">
      <input checked={props.areAllTicked} className="accent-primary" onChange={props.onToggleAll} type="checkbox" />
      {LEFTOVER_LABELS.SELECT_ALL}
    </label>
    <ChecklistSection
      checklistRows={props.worktreeRows}
      legend={LEFTOVER_LABELS.WORKTREES_SECTION}
      onToggleRow={props.onToggleRow}
      tickedRowKeys={props.tickedRowKeys}
    />
    <ChecklistSection
      checklistRows={props.branchRows}
      legend={LEFTOVER_LABELS.BRANCHES_SECTION}
      onToggleRow={props.onToggleRow}
      tickedRowKeys={props.tickedRowKeys}
    />
  </div>
);

import {LeftoverSection} from "@/modules/sessions/components/userInputDialog/components/cleanUpInput/components/leftoverChecklist/components/leftoverSection.tsx";
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
  <div className="flex max-h-80 min-w-0 flex-col gap-3 overflow-y-auto">
    <label className="flex items-center gap-2 px-2 text-xs font-medium text-foreground-strong">
      <input checked={props.areAllTicked} className="accent-primary" onChange={props.onToggleAll} type="checkbox" />
      {LEFTOVER_LABELS.SELECT_ALL}
    </label>
    <LeftoverSection
      leftoverRows={props.worktreeRows}
      legend={LEFTOVER_LABELS.WORKTREES_SECTION}
      onToggleRow={props.onToggleRow}
      tickedRowKeys={props.tickedRowKeys}
    />
    <LeftoverSection
      leftoverRows={props.branchRows}
      legend={LEFTOVER_LABELS.BRANCHES_SECTION}
      onToggleRow={props.onToggleRow}
      tickedRowKeys={props.tickedRowKeys}
    />
  </div>
);

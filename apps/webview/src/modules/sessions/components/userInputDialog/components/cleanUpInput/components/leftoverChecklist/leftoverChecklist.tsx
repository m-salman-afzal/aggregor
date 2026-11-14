import {CleanUpButtons} from "@/modules/sessions/components/userInputDialog/components/cleanUpInput/components/leftoverChecklist/components/cleanUpButtons.tsx";
import {LeftoverList} from "@/modules/sessions/components/userInputDialog/components/cleanUpInput/components/leftoverChecklist/components/leftoverList.tsx";
import {useLeftoverChecklist} from "@/modules/sessions/components/userInputDialog/components/cleanUpInput/components/leftoverChecklist/leftoverChecklist.hook.ts";
import {LEFTOVER_LABELS} from "@pkg/constants/src/git.constant.ts";
import {DialogDescription} from "@pkg/ui/src/components/base/dialog.tsx";

import type {ChosenLeftovers} from "@/modules/sessions/sessions.type.ts";
import type {ProjectLeftoversDto} from "@dtos/worktree.dto.ts";

interface LeftoverChecklistProps {
  readonly leftovers: ProjectLeftoversDto;
  readonly onCancel: () => void;
  readonly onDelete: (chosenLeftovers: ChosenLeftovers) => void;
}

export const LeftoverChecklist = (props: LeftoverChecklistProps) => {
  const leftoverChecklistView = useLeftoverChecklist(props);

  return (
    <>
      {leftoverChecklistView.isEmpty ? (
        <DialogDescription className="text-foreground/80">{LEFTOVER_LABELS.NONE}</DialogDescription>
      ) : (
        <LeftoverList
          areAllTicked={leftoverChecklistView.areAllTicked}
          branchRows={leftoverChecklistView.branchRows}
          onToggleAll={leftoverChecklistView.toggleAll}
          onToggleRow={leftoverChecklistView.toggleRow}
          tickedRowKeys={leftoverChecklistView.tickedRowKeys}
          worktreeRows={leftoverChecklistView.worktreeRows}
        />
      )}
      <CleanUpButtons
        isDeleteShown={!leftoverChecklistView.isEmpty}
        isNothingTicked={leftoverChecklistView.isNothingTicked}
        onCancel={props.onCancel}
        onDelete={leftoverChecklistView.deleteTicked}
      />
    </>
  );
};

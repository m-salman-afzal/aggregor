import {LeftoverChecklist} from "@/modules/sessions/components/userInputDialog/components/cleanUpInput/components/leftoverChecklist/leftoverChecklist.tsx";
import {APP_LABELS} from "@pkg/constants/src/app.constant.ts";
import {LEFTOVER_LABELS} from "@pkg/constants/src/git.constant.ts";
import {Button} from "@pkg/ui/src/components/base/button.tsx";
import {DialogDescription} from "@pkg/ui/src/components/base/dialog.tsx";

import type {ChosenLeftovers} from "@/modules/sessions/sessions.type.ts";
import type {ProjectLeftoversDto} from "@dtos/worktree.dto.ts";

interface CleanUpInputProps {
  readonly leftovers: ProjectLeftoversDto | undefined;
  readonly onCancel: () => void;
  readonly onDelete: (chosenLeftovers: ChosenLeftovers) => void;
}

export const CleanUpInput = (props: CleanUpInputProps) => {
  if (props.leftovers !== undefined)
    return <LeftoverChecklist leftovers={props.leftovers} onCancel={props.onCancel} onDelete={props.onDelete} />;

  return (
    <>
      <DialogDescription className="text-foreground/80">{LEFTOVER_LABELS.CHECKING}</DialogDescription>
      <div className="flex justify-end">
        <Button onClick={props.onCancel} size="sm" variant="soft">
          {APP_LABELS.CANCEL}
        </Button>
      </div>
    </>
  );
};

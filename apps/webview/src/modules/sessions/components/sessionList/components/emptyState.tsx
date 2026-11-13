import {SESSION_LISTS, SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";
import {PROJECT_LABELS} from "@pkg/constants/src/project.constant.ts";
import {Button} from "@pkg/ui/src/components/base/button.tsx";

import type {SessionListId} from "@/modules/sessions/sessions.type.ts";

interface EmptyStateProps {
  readonly listId: SessionListId;
  readonly onAddProject: () => void;
}

export const EmptyState = (props: EmptyStateProps) => {
  if (props.listId === SESSION_LISTS.ARCHIVE)
    return <p className="px-3 pt-1 pb-3 text-muted-foreground">{SESSIONS_LABELS.ARCHIVE_EMPTY}</p>;

  return (
    <div className="flex flex-col items-start gap-3 px-3 pt-1 pb-3">
      <p className="text-muted-foreground">{SESSIONS_LABELS.NO_PROJECTS}</p>
      <Button onClick={props.onAddProject} size="sm">
        {PROJECT_LABELS.ADD_FOLDERS}
      </Button>
    </div>
  );
};

import {SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";
import {PROJECT_LABELS} from "@pkg/constants/src/project.constant.ts";
import {Button} from "@pkg/ui/src/components/base/button.tsx";

interface EmptyStateProps {
  readonly onAddProject: () => void;
}

export const EmptyState = (props: EmptyStateProps) => (
  <main className="flex flex-col items-start gap-3 px-5 py-3">
    <p className="text-muted-foreground">{SESSIONS_LABELS.NO_PROJECTS}</p>
    <Button onClick={props.onAddProject} size="sm">
      {PROJECT_LABELS.ADD_FOLDERS}
    </Button>
  </main>
);

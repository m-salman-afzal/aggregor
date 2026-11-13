import {EmptyState} from "@/modules/sessions/components/emptyState.tsx";
import {ProjectGroup} from "@/modules/sessions/components/projectGroup/projectGroup.tsx";
import {useSessions} from "@/modules/sessions/sessions.hook.ts";

// The Sessions view: each project with its sessions, or a way to add the first project.
export const Sessions = () => {
  const sessionsView = useSessions();
  if (!sessionsView.isDrawn) return null;
  if (sessionsView.projectRows.length === 0) return <EmptyState onAddProject={sessionsView.addProject} />;

  return (
    <main className="flex flex-col gap-1 py-1">
      {sessionsView.projectRows.map((projectRow) => (
        <ProjectGroup key={projectRow.nodeId} projectRow={projectRow} />
      ))}
    </main>
  );
};

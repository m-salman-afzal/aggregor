import type {ProjectRowData, SessionsViewMessage} from "@views/sessions/sessions.view.type.ts";

// Each host message by its tag, for the reducer of each.
export type HostMessagesByTag = {[HostMessage in SessionsViewMessage as HostMessage["_tag"]]: HostMessage};

// The rows the host drew last, the session in front, and the projects the user folded away. VS Code keeps the last two
// for the page, which reloads each time the view comes back into sight, so the view looks as it was left; the host
// tells a reloaded page the session in front only while the window has focus. Nothing shows until the host's first
// drawing.
export interface SessionsData {
  readonly collapsedProjectNodeIds: ReadonlySet<string>;
  readonly isDrawn: boolean;
  readonly projectRows: readonly ProjectRowData[];
  readonly viewedSessionId: string | undefined;
}

export interface SessionsState extends SessionsData {
  readonly setProjectOpen: (projectNodeId: string, isOpen: boolean) => void;
}

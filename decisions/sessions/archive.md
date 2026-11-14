# Archive

Archiving sessions, and stopping or keeping their agents.

## The views ask for archived sessions by name

- **Problem:** the Archive view needs its own lists, and a view needs to tell an archived session from another, but
  presentation can't import the domain's `SESSION_LIFECYCLES`.
- **Decision:** `listProjectsWithArchivedSessions` in `session.service.ts`, beside `listProjectsWithSessions`, which
  lists only the ongoing sessions; `isArchived` on `SessionListItemDto`; and a controller function per read. Each list
  asks for what it shows, and the lifecycle stays the backend's.
- **Alternatives considered:** a lifecycle field in the list requests, which the views would fill with a value the
  domain owns; the session list item's lifecycle value object, which the views would compare with that same value.

## The Archive lists the listed projects, and redraws whole

- **Problem:** Archive groups by project, but which projects, and how it redraws when a project gets its first archived
  session: the Sessions view redraws that project's row, which the Archive doesn't have yet.
- **Decision:** the projects the Sessions view lists, workspace folders and added ones, that have an archived session,
  in the list's order. A session's own change redraws its row, and any other change the whole tree. A project hides its
  archived sessions as it hides its others, and the tree is small enough to draw whole.
- **Alternatives considered:** every project with an archived session, listed or not, which would show a removed
  project's archived sessions while its others stay hidden; redrawing one project's row, which misses a project row that
  arrives or goes.

## Archiving never asks, and the agent keeps running

- **Problem:** archiving asked whether to keep a running agent or stop it, a question on the commonest action.
- **Decision:** Archive, Archive Sessions and Archive All Sessions move the sessions to the Archive at once, whatever
  their agents are doing: each agent runs on in tmux and finishes its turn, and its tab closes. Stop Agent in the
  Archive stops it. Unarchive moves a session back, so nothing is lost by not asking.
- **Solution:** `archiveSessionsKeepingAgents` in `session.service.ts`, for one session or many.
- **Alternatives considered:** asking whether to keep or stop a running agent, first so Enter kept it, which was built
  and dropped as one question too many; asking only while a turn runs and stopping the agent, which cut turns short.

## Agents stop from the session, project and list menus, asking only mid-turn

- **Problem:** with Archive keeping agents running, the user needs to stop them: one, a project's, or a whole list's,
  without a question when nothing is lost.
- **Decision:** Stop Agent in a session row's … menu while its agent runs, in both lists; Stop Agents in a project row's
  … menu, for that project's sessions in that list; Stop All Agents in each list's … menu. A stop asks only when it cuts
  a turn short (an agent working, or waiting on a permission, a question or a sign-in), naming how many agents stop and
  how many are mid-turn; idle agents stop without a question. The stopped sessions' tabs close. They are five commands,
  since a project's or a list's menu doesn't tell its command which list it is in.
- **Solution:** the webview asks, from each row's `isAgentRunning` and status; the stop use cases stop every running
  agent they are given. Each stopped agent raises its own exited alert, so Stop All Agents raises one per agent.
- **Alternatives considered:** asking every time, which questions a stop that loses nothing; inline stop buttons on the
  rows; a stop for one session only.

## A project's sessions, or all of them, archive at once

- **Problem:** archiving is one session at a time, from its row, so clearing a project or the whole list means one click
  per session.
- **Decision:** Archive Sessions in a Sessions-list project row's … menu archives the project's sessions, and Archive
  All Sessions in the Sessions list's … menu archives every session it lists. Each sits under its Stop Agents item; the
  Archive has neither. Like a row's Archive, neither asks: every session is archived in its order, placed at the end of
  the Archive together, and its tab closes while its agent runs on.
- **Solution:** `aggregorApp.archiveProjectSessions` and `aggregorApp.archiveOngoingSessions`, over
  `archiveSessionsKeepingAgents`.
- **Alternatives considered:** Unarchive Sessions and Unarchive All Sessions in the Archive's menus too: left until they
  are missed. One question for them all, which was built and dropped with the row's question.

## The Archive list leaves out the Sessions list's extras

- **Problem:** the Sessions list starts sessions in a project and moves projects.
- **Decision:** an archived session's menu has Move Up and Move Down, Stop Agent, Rename, Unarchive and Remove; an
  Archive project's has only Stop Agents, with no + and no Move or Remove Project, since a project's place and its
  listing are the Sessions list's. The session in front is marked in whichever list holds it. None of the rest was asked
  for.
- **Alternatives considered:** the same project menu in both lists, which would let the Archive move or remove a project
  the Sessions list shows.

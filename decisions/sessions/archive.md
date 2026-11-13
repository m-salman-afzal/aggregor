# Archive

Archiving sessions, and stopping or keeping their agents.

## The views ask for archived sessions by name

- **Problem:** the Archive view needs its own lists, and a view needs to tell an archived session from another, but
  presentation can't import the domain's `SESSION_LIFECYCLES`.
- **Decision:** `listArchivedProjectSessionIds` and `listProjectsWithArchivedSessions` in `session.service.ts`, beside
  `listProjectSessionIds`, which now lists only the ongoing sessions; `isArchived` on `SessionListItemDto`; and the
  controllers' `…ForArchiveView` functions, one per read. Each view asks for what it shows, and the lifecycle stays the
  backend's.
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

## The Archive view leaves out the Sessions view's extras

- **Problem:** the Sessions view also takes drops, keeps the session in front selected and turns the working spinner.
- **Decision:** the Archive has Move Up and Move Down in its menu but no drag and drop, and keeps nothing selected; the
  Sessions view skips an archived session in front, whose row it doesn't have, rather than retrying its reveal. The
  Archive draws its own rows' badges and spinner. None of them was asked for, and each can come with its own step if it
  is missed.
- **Solution:** the spinner turns only while the Sessions pane is visible, so a working archived session's spinner stops
  while that pane is collapsed.

## Archiving asks whether to keep the agent running

- **Problem:** stopping the agent on Archive cuts a running turn short, and the user wants the turn to finish and to
  decide when the agent exits.
- **Decision:** with its agent running, Archive asks whether to keep it running, first so that Enter keeps it, or stop
  it; Cancel or Escape leaves the session where it is. Its tab closes either way: a kept agent runs on in tmux, finishes
  its turn and opens again from the Archive. With no agent running, it asks nothing. The user decides when they archive,
  and nothing is cut short unless they choose it.
- **Alternatives considered:** archiving with the agent left running and nothing asked; asking only while a turn runs
  (`isSessionTurnRunning`: working, or blocked on a permission, a question or a sign-in) and then stopping the agent,
  which was built first and dropped because the user wants the turn to finish and to decide when the agent exits.

## Agents stop from the session, project and view menus

- **Problem:** with Archive keeping agents running, the user needs to stop them: one, a project's, or a whole view's.
- **Decision:** Stop Agent in a session row's … menu while its agent runs, in both views; Stop Agents in a project row's
  … menu, for that project's sessions in that view, now on every project row in both views; Stop All Agents in each
  view's title … menu, for the sessions that view lists. Each asks every time, naming how many agents stop and how many
  of them are mid-turn, and closes the stopped sessions' tabs. They are five commands, since a title or project menu
  doesn't tell its command which view it is in. Each scope stops from where it is shown, and asking every time keeps a
  stop from being a slip.
- **Solution:** each stopped agent raises its own exited alert, so Stop All Agents raises one per agent.
- **Alternatives considered:** inline stop buttons on the rows; a stop for one session only.

## A project's sessions, or all of them, archive at once

- **Problem:** archiving is one session at a time, from its row, so clearing a project or the whole list means one menu
  and one question per session.
- **Decision:**
  - ⤓ Archive Sessions in a Sessions view project row's … menu archives the project's sessions, and ⤓ Archive All
    Sessions in the view's title … menu archives every session the view lists, the ones Stop All Agents covers. Each
    sits under its Stop Agents item; the Archive view has neither.
  - One question for them all, every time. With agents running, it asks whether to keep them running, first so that
    Enter keeps them, or to stop them, worded for one agent or several and for turns cut short; with none, whether to
    archive the sessions. Cancel or Escape archives none.
  - A project with one session archives it as its row's Archive does, asking only while its agent runs, rather than
    asking "Archive 1 sessions?".
  - Every session is archived, in its order and placed at the end of the Archive together, before any agent stops, so a
    failed write stops none for nothing; every tab closes, and a kept agent runs on in tmux. A session row's Archive
    runs the same code with one session.
  - `aggregorApp.archiveProjectSessions` and `aggregorApp.archiveOngoingSessions`, hidden from the Command Palette;
    `archiveProjectSessions` and `archiveOngoingSessions` in `session.service.ts` over
    `archiveSessionsAskingAboutAgents`; `makeArchiveSessionsQuestion` in `sessionQuestion.utils.ts`, whose keep and stop
    answers the row's Archive question now shares.

  A batch archives from where it is listed, as its agents stop, and one click that moves many sessions always asks.

- **Solution:** a session removed while the question is open leaves the sessions after it unarchived, their tabs open
  and no agent stopped.
- **Alternatives considered:**
  - Unarchive Sessions and Unarchive All Sessions in the Archive view's menus too: left until they are missed.
  - Asking nothing when no agent runs, as a session row's Archive does: one click here moves many sessions.
  - Building it with the first worktree step: a bigger PR for two unrelated changes.

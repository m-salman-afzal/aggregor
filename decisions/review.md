# Review comments

Commenting on code lines, and sending the comments to a session's agent.

## A comment is a VS Code comment thread

- **Problem:** telling an agent what to change in its work meant copying a path, its line numbers and a remark into the
  agent's prompt, once per remark. Orca, Conductor and Warp let the user comment on a diff's lines and send the batch.
- **Decision:** VS Code's Comments API (`comments.createCommentController`), with no UI of our own: the `+` beside a
  line, in an editor and on the changed side of a diff, a range by dragging it, the thread's box, the Comments panel
  that lists every thread and, in an editor, Add Comment on Current Selection (Ctrl+K Ctrl+Alt+C) are VS Code's. Any
  `file:` document takes comments, which covers a file and the changed side of its diff.
- **Solution:** `ReviewCommentsView` (`presentation/views/reviewComments/`) owns the comment controller and draws one
  thread per `ReviewCommentDto`: every pending comment when the window starts, then each change
  `ReviewCommentService.watchReviewCommentChanges` streams, so a comment added, edited, deleted or sent in any window
  shows in all of them. The buttons are the manifest's `comments/*` menus: Add Comment on a draft, Edit and Delete on a
  comment, Save and Cancel while editing, and Send Comments to Session on a thread's title bar. Save and Delete run
  `ReviewCommentController`'s commands with the comment VS Code hands them, which carries its `reviewCommentId`. The
  view registers the commands that need VS Code's own objects and runs the controller's with a complete request, as the
  Sessions view does for its webview: Add Comment, which reads the draft's file and lines and then disposes VS Code's
  draft thread; Edit and Cancel, which only switch a comment between reading and editing; and Send, which reads the
  lines each thread sits on now.
- **Alternatives considered:**
  - A list in the Sessions webview, or decorations of our own: both rebuild what the Comments API ships.
  - Comments on a diff's original side: its lines number the old version of the file, which the agent can't open.
  - Comments on the agent's reply: the reply is a terminal's text, and no stable API reads a terminal's selection or
    puts a comment there. T3 Code turned the same feature down as "copy and paste already covers this". Opening the
    reply from the agent's transcript as a read-only document, where the same thread works, is the way if it is wanted.
  - The controller taking every button's command: nothing below the view may touch VS Code's draft thread or a comment's
    editing mode, and a controller only decodes its input and calls one service.

## VS Code's comment defaults that Aggregor changes

- **Problem:** the first comment opened VS Code's Comments panel over the Terminal; the highlight on the commented lines
  was a tenth of the theme's focus colour, hard to see, and left the last line out; Add Comment only appeared once the
  box held text; and adding a comment left the focus nowhere, since the draft box that held it is disposed.
- **Decision:** the manifest's `configurationDefaults` set `comments.openView` to `never` and the two highlight colours,
  `editorCommentsWidget.rangeBackground` and `editorCommentsWidget.rangeActiveBackground`, to a translucent amber. Add
  Comment is always in the box, and its command's `enablement` (`!commentIsEmpty`) greys it out while the box is empty.
  The view hands the focus back to the editor once a comment is added, and gives each thread a range that ends past its
  last line's end, so the highlight covers that line too: VS Code draws none for a range that ends at a line's start.
  The Comments API has no option for any of these. They are defaults, so the user's own settings win, and they hold for
  every extension's comments, GitHub Pull Requests' included.
- **Alternatives considered:**
  - `editorGutter.commentRangeForeground` brighter, so a drag of the `+` over several lines stands out: the same colour
    draws the bar VS Code keeps beside every line that takes a comment, so every file got a bright bar down its gutter.
    VS Code gives an extension no other hold on the drag. Selecting the lines as text and clicking the `+` inside the
    selection comments on the selection, which shows as any selection does.
  - A smaller or floating comment box: the box's size and place are VS Code's, with no setting and no API.
  - Colours that follow the theme: `workbench.colorCustomizations` takes fixed colours only.

## Pending comments are rows in the database

- **Problem:** a comment thread lives in the extension host's memory, and the first project switch reloads the window,
  which would drop every comment not sent yet.
- **Decision:** a `reviewComments` table: the file's absolute path, the lines and the text. The database is the one copy
  of the data, as for sessions and projects, so a reload, a restart and a second window all show the same comments.
- **Solution:** `ReviewCommentEntity`, `IReviewCommentRepository` and `ReviewCommentRepository` on the base pieces, and
  the `add_review_comments` migration, which only adds the table. `storage.md` lists the columns.
- **Alternatives considered:** threads in memory only, the least code, lost on a reload; `workspaceState`, which an
  untitled workspace drops when it is saved.

## Comments go to the session last in view that works in their folder

- **Problem:** a send needs a session, and while the user is in a code file no session's tab is in front, so
  `ITerminalInfraService.viewedSessionId`, the session in view, holds none.
- **Decision:** the target is the ongoing session that was last in view, by `viewedAt`, among those whose working folder
  holds a pending comment. Only the comments under that folder are sent; the rest stay pending for their own session. A
  comment on a file can only mean something to an agent that works in the file's folder, and `viewedAt` is written as a
  session's tab comes into and leaves view, so the latest one is the session the user just left for the file.
- **Solution:** `ReviewCommentService.sendReviewComments`. It fails with `NoReviewCommentsError` when nothing is
  pending, `NoSessionForReviewCommentsError` when no session that was ever in view works in a commented file's folder,
  and `SessionAgentNotRunningError` when the target's agent isn't running; `ReviewCommentErrorMessage` holds each one's
  text.
- **Alternatives considered:**
  - The session in view: never set while a file is in front.
  - The session last in view, whatever its folder: with two windows, the other window's session can be the later one,
    and the send would find none of its comments there.
  - A picker, as Orca's "Send notes to" menu: one more step on every send, for a choice the folder already makes.

## The comments reach the agent as one paste, not sent

- **Problem:** nothing typed into a session's agent before, and the text has several lines, which an agent's prompt box
  takes as one message only from a bracketed paste.
- **Decision:** tmux pastes it into the agent's tmux session with `paste-buffer -p`, as the middle click in `tmux.conf`
  does. It reaches an agent whose tab is closed and the right one behind a shared tab, since tmux names each agent's
  session by its session's id. Nothing presses Enter: the text lands in the prompt box, the session comes into view, and
  the user adds what they want and sends it.
- **Solution:** `TmuxServerUtils.pasteTextIntoTmuxSession` runs three commands: `send-keys -X cancel`, since tmux leaves
  the brackets out for a pane in copy mode, where the mouse wheel leaves it, and each newline would then arrive as
  Enter; `load-buffer -` with the text on stdin, since tmux reads a `;` at the end of an argument as a command
  separator; and `paste-buffer -p -d`. `ITmuxInfraService.pasteTextIntoSessionAgent` is the port, and the use case then
  opens the session as its row's click does.
- **Alternatives considered:**
  - `Terminal.sendText`: needs the session's tab open, and a shared tab shows one session at a time.
  - Sending the prompt at once: the user can't add a sentence, and a wrong target would start a turn.

## A comment is sent as `cite:`, its file and lines, then its text

- **Decision:** plain text every agent reads, the path relative to the session's folder, comments in file and line order
  with a blank line between them:

  ```text
  cite: apps/extension/src/application/services/session.service.ts:374-376
  guard the archived case here

  cite: packages/ui/src/button.tsx:12
  why not the shared variant?
  ```

  The lines are the ones each thread sits on when the comments are sent (see "A comment's thread follows its file's
  edits"). Sent comments are deleted, since the agent's conversation now holds them.

- **Solution:** `ReviewCommentDomainService.formatReviewPrompt`.
- **Alternatives considered:** Claude Code's `@file#374-376`, which the other agents don't read; XML blocks, as T3
  Code's closed pull request built; sent comments kept as resolved threads, a history nothing reads.

## A comment's thread follows its file's edits

- **Problem:** VS Code moves a thread's mark in the gutter as lines are added or removed above it, but leaves the
  thread's range, which the Comments panel shows and a send reads, on the old lines. A comment would cite lines its code
  has left.
- **Decision:** the view moves each shown thread itself. On every change of a `file:` document it shifts the document's
  threads by the lines added or removed above them, and stretches or shrinks one by the lines added or removed inside
  it. A send carries the lines each thread sits on, and the use case saves them before it reads the comments, so the
  prompt cites where the code is now.
- **Solution:** `ReviewCommentsView.moveShownThreadsWithDocumentChange`, on `workspace.onDidChangeTextDocument`,
  untraced, since it runs on every keystroke and the trace log is a document too; a file changed on disk reaches its
  open document the same way. `SendReviewCommentsRequestDto.currentLineRanges` carries the lines, and a thread drawn
  again keeps its range, since the stored lines lag behind until the next send. Its limits: an edit that replaces a
  block reaching past a thread's lines on either side, such as Delete Duplicate Lines or a file rewritten on disk above
  and below a comment at once, can't say where the lines went, so the thread keeps its line numbers; a file that changes
  while no document of it is open keeps the stored lines; and a window reload draws each thread on the lines last saved.
- **Alternatives considered:**
  - Saving every move at once: a second window with the same file open would shift the stored lines a second time when
    the file is saved.
  - The stored lines only: wrong after any edit above a comment, while the mark in the gutter shows the new line.
  - The commented code quoted under each `cite:`, for the agent to find by its text: it makes the prompt long.

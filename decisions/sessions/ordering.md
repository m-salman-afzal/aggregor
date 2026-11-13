# Ordering

How projects and sessions are put in order.

## Projects and sessions move up and down

- **Problem:** the Sessions view listed projects in the order they were added and sessions in the order they started,
  and the user wants to arrange both.
- **Decision:**
  - Drag and drop, and Move Up and Move Down in each row's … menu. A session moves among its project's sessions, an
    added project among the added projects; the window's own folders stay first and don't move.
  - A dropped row takes the place of the row it is dropped on: after it when moving down, before it when moving up. Any
    other drop does nothing: on another project's session, a session on a project, a project on a session.
  - A move places the rows from the first place that changes on, in their new order, after every other row of the table:
    the base repository's `placeAtEnd`, one `UPDATE` that reads the highest `sortId` once. `findEntityIdsToPlaceAtEnd`
    in `sortOrder.domainService.ts` works those rows out.
  - The change feed reads those rows as placed, as it reads a new row, so every window, this one included, reads the
    project's sessions or the project list again. The kind `added` became `placed`, an `EntityChangeKindValueObject`
    with `ENTITY_CHANGE_KINDS`, since a moved row was never added; lint bans comparing with the kind strings.
  - `ProjectListItemDto` and `SessionListItemDto` carry `canMoveUp` and `canMoveDown`, from the row's place in the order
    (`canMoveUpInOrder`, `canMoveDownInOrder`); each row's context value lists them after its kind
    (`session canMoveUp`), and the menus show Move Up and Move Down only where they move. Each add, remove or move
    already reads the whole list again, so the flags stay right.
  - The view's `handleDrag` keeps the dragged row's node id under the tree's own drag type, and `handleDrop` hands both
    node ids to the project or session controller. A drag and a drop are root spans (`SessionsView.keepDraggedNodeId`,
    `SessionsView.moveDroppedRow`), and a failed drop is logged.

  Dragging is the quick way and the menu the one the keyboard reaches, and both run one service per kind. The order
  lives in the column every read already sorts by, and the change feed needs nothing new to redraw a move.

- **Solution:** VS Code drops onto a row, never between two, and gives keyboard users no drag; Move Up and Move Down
  cover them. No keybinding: a keybinding gets no row, so it would move the session in front.
- **Alternatives considered:**
  - Gestures: drag and drop only, which the keyboard and screen readers can't reach; Move Up and Move Down only; inline
    arrow buttons, beside the two buttons rows already have.
  - Storage: a `position` column, whose moves would arrive as plain updates, which redraw only the moved session's row,
    and the change feed can't tell a move from another update without keeping a copy of the rows. Swapping two rows'
    `sortId`s, for the same reason.
  - The drop: always before the row dropped on, with a drop on the project row moving a session to the end.
  - The drop through a hidden command, for the command's root span and presenter; the view calls a controller directly,
    as it does for its reads.
  - Showing Move Up and Move Down on every row, doing nothing at an end; the flags come from the order the services read
    anyway.

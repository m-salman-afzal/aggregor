# Ordering

How projects and sessions are put in order.

## Projects and sessions move up and down

- **Problem:** the Sessions view listed projects in the order they were added and sessions in the order they started,
  and the user wants to arrange both.
- **Decision:**
  - Move Up and Move Down in each row's … menu. A session moves among its project's sessions, an added project among the
    added projects; the window's own folders stay first and don't move.
  - A move places the rows from the first place that changes on, in their new order, after every other row of the table:
    the base repository's `placeAtEnd`, one `UPDATE` that reads the highest `sortId` once. `findEntityIdsToPlaceAtEnd`
    in `sortOrder.domainService.ts` works those rows out.
  - The change feed reads those rows as placed, as it reads a new row, so every window, this one included, reads the
    project's sessions or the project list again. The kind `added` became `placed`, an `EntityChangeKindValueObject`
    with `ENTITY_CHANGE_KINDS`, since a moved row was never added; lint bans comparing with the kind strings.
  - `ProjectListItemDto` and `SessionListItemDto` carry `canMoveUp` and `canMoveDown`, from the row's place in the order
    (`canMoveUpInOrder`, `canMoveDownInOrder`), and the webview's menus show Move Up and Move Down only where they move.
    Each add, remove or move already reads the whole list again, so the flags stay right.

  The order lives in the column every read already sorts by, and the change feed needs nothing new to redraw a move.

- **Solution:** no keybinding: a keybinding gets no row, so it would move the session in front.
- **Alternatives considered:**
  - Gestures: drag and drop beside the menu, which the tree view had: a dropped row took the place of the row it was
    dropped on (`moveSessionToPlaceOf`, `moveProjectToPlaceOf`). Its handlers went with the tree when the view became a
    webview, and the use cases nothing called any more were deleted; they come back with the webview's own drag and
    drop. Drag and drop only, which the keyboard and screen readers can't reach; inline arrow buttons, beside the two
    buttons rows already have.
  - Storage: a `position` column, whose moves would arrive as plain updates, which redraw only the moved session's row,
    and the change feed can't tell a move from another update without keeping a copy of the rows. Swapping two rows'
    `sortId`s, for the same reason.
  - Showing Move Up and Move Down on every row, doing nothing at an end; the flags come from the order the services read
    anyway.

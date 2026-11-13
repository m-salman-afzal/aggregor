import {ROW_ACTIONS, SESSION_LISTS} from "@/modules/sessions/sessions.constant.ts";

import type {RowAction, SessionListId} from "@/modules/sessions/sessions.type.ts";
import type {ProjectListItemDto} from "@dtos/project.dto.ts";

export const keepApplyingActions = (actionGroups: readonly (readonly (false | RowAction)[])[]) =>
  actionGroups
    .map((actionGroup) => actionGroup.filter((rowAction): rowAction is RowAction => rowAction !== false))
    .filter((actionGroup) => actionGroup.length > 0);

export const listProjectActionGroups = (projectListItem: ProjectListItemDto, listId: SessionListId) =>
  listId === SESSION_LISTS.ARCHIVE
    ? [[ROW_ACTIONS.STOP_ARCHIVED_PROJECT_AGENTS]]
    : keepApplyingActions([
        [
          projectListItem.canMoveUp && ROW_ACTIONS.MOVE_PROJECT_UP,
          projectListItem.canMoveDown && ROW_ACTIONS.MOVE_PROJECT_DOWN
        ],
        [ROW_ACTIONS.NEW_TERMINAL],
        [ROW_ACTIONS.STOP_PROJECT_AGENTS, ROW_ACTIONS.ARCHIVE_PROJECT_SESSIONS],
        [ROW_ACTIONS.PROJECT_SETTINGS, projectListItem.isAdded && ROW_ACTIONS.REMOVE_PROJECT]
      ]);

export const listProjectInlineActions = (listId: SessionListId) =>
  listId === SESSION_LISTS.SESSIONS ? [ROW_ACTIONS.NEW_SESSION] : [];

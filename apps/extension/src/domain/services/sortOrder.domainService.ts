import {Array, Effect} from "effect";

import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

// How rows move within an order, such as one project's sessions: a moved row takes the place of the row at the target,
// so it lands after that row when it moves down and before it when it moves up.

// The rows from the first place that changes on, in their new order; placing them after every other row of the table
// gives the new order. A place outside the order, or the same place twice, moves nothing.
export const findEntityIdsToPlaceAtEnd = Effect.fn("SortOrderDomainService.findEntityIdsToPlaceAtEnd")(function* (
  orderedEntityIds: readonly EntityIdValueObject[],
  movedIndex: number,
  targetIndex: number
) {
  const movedEntityId = orderedEntityIds[movedIndex];
  const isTargetInOrder = targetIndex >= 0 && targetIndex < orderedEntityIds.length;
  if (movedEntityId === undefined || !isTargetInOrder || movedIndex === targetIndex) return [];
  const otherEntityIds = Array.remove(orderedEntityIds, movedIndex);
  const reorderedEntityIds = [
    ...otherEntityIds.slice(0, targetIndex),
    movedEntityId,
    ...otherEntityIds.slice(targetIndex)
  ];

  return reorderedEntityIds.slice(Math.min(movedIndex, targetIndex));
});

// A row outside the order moves neither way.
export const canMoveUpInOrder = Effect.fn("SortOrderDomainService.canMoveUpInOrder")(function* (
  orderedEntityIds: readonly EntityIdValueObject[],
  entityId: EntityIdValueObject
) {
  return orderedEntityIds.indexOf(entityId) > 0;
});

export const canMoveDownInOrder = Effect.fn("SortOrderDomainService.canMoveDownInOrder")(function* (
  orderedEntityIds: readonly EntityIdValueObject[],
  entityId: EntityIdValueObject
) {
  const entityIndex = orderedEntityIds.indexOf(entityId);

  return entityIndex !== -1 && entityIndex < orderedEntityIds.length - 1;
});

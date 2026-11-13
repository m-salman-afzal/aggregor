import {Array, Effect} from "effect";

import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

// A moved row takes the place of the row at the target: after it when moving down, before it when moving up.

// Placing these rows after every other row of the table gives the new order.
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

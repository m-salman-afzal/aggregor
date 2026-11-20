import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Array, Context, Effect, Layer} from "effect";

import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

// A moved row takes the place of the row at the target: after it when moving down, before it when moving up.

export class SortOrderDomainService extends Context.Service<SortOrderDomainService>()(
  "aggregor-app/domain/services/sortOrder.domainService/SortOrderDomainService",
  {
    make: Effect.fn("make")(function* () {
      // Placing these rows after every other row of the table gives the new order.
      const findEntityIdsToPlaceAtEnd = Effect.fn("findEntityIdsToPlaceAtEnd")(function* (
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

      const canMoveUpInOrder = Effect.fn("canMoveUpInOrder")(function* (
        orderedEntityIds: readonly EntityIdValueObject[],
        entityId: EntityIdValueObject
      ) {
        return orderedEntityIds.indexOf(entityId) > 0;
      });

      const canMoveDownInOrder = Effect.fn("canMoveDownInOrder")(function* (
        orderedEntityIds: readonly EntityIdValueObject[],
        entityId: EntityIdValueObject
      ) {
        const entityIndex = orderedEntityIds.indexOf(entityId);

        return entityIndex !== -1 && entityIndex < orderedEntityIds.length - 1;
      });

      return {canMoveDownInOrder, canMoveUpInOrder, findEntityIdsToPlaceAtEnd};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("SortOrderDomainService", this.make()));
}

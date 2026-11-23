import {Array, Context, Effect, Layer} from "effect";

import type {EntityIdValueObject} from "@/valueObjects/entityId.valueObject.ts";

export class SortOrderDomainService extends Context.Service<SortOrderDomainService>()(
  "aggregor-app/domain/services/sortOrder.domainService/SortOrderDomainService",
  {
    make: Effect.fn("SortOrderDomainService.make")(function* () {
      const findEntityIdsToPlaceAtEnd = Effect.fn("SortOrderDomainService.findEntityIdsToPlaceAtEnd")(function* (
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

      const canMoveUpInOrder = Effect.fn("SortOrderDomainService.canMoveUpInOrder")(function* (
        orderedEntityIds: readonly EntityIdValueObject[],
        entityId: EntityIdValueObject
      ) {
        return orderedEntityIds.indexOf(entityId) > 0;
      });

      const canMoveDownInOrder = Effect.fn("SortOrderDomainService.canMoveDownInOrder")(function* (
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
  public static readonly layer = Layer.effect(this, this.make());
}

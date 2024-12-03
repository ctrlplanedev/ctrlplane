import type { Tx } from "@ctrlplane/db";
import type { Resource } from "@ctrlplane/db/schema";
import _ from "lodash";

import { eq, inArray, or } from "@ctrlplane/db";
import { resource, resourceRelationship } from "@ctrlplane/db/schema";

import { getEventsForResourceDeleted, handleEvent } from "../events/index.js";

const deleteObjectsAssociatedWithResource = (tx: Tx, resource: Resource) =>
  tx
    .delete(resourceRelationship)
    .where(
      or(
        eq(resourceRelationship.fromIdentifier, resource.identifier),
        eq(resourceRelationship.toIdentifier, resource.identifier),
      ),
    );

/**
 * Delete resources from the database.
 *
 * @param tx - The transaction to use.
 * @param resourceIds - The ids of the resources to delete.
 */
export const deleteResources = async (tx: Tx, resources: Resource[]) => {
  const eventsPromises = Promise.all(
    resources.map(getEventsForResourceDeleted),
  );
  const events = await eventsPromises.then((res) => res.flat());
  await Promise.all(events.map(handleEvent));
  const resourceIds = resources.map((r) => r.id);
  const deleteAssociatedObjects = Promise.all(
    resources.map((r) => deleteObjectsAssociatedWithResource(tx, r)),
  );
  await Promise.all([
    deleteAssociatedObjects,
    tx
      .update(resource)
      .set({ deletedAt: new Date() })
      .where(inArray(resource.id, resourceIds)),
  ]);
};

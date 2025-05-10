import type * as schema from "@ctrlplane/db/schema";
import _ from "lodash";

import { db } from "@ctrlplane/db/client";
import { getResourceParents } from "@ctrlplane/db/queries";

export const getReferenceVariableValue = async (
  variable: schema.ReferenceResourceVariable,
) => {
  const { relationships, getTargetsWithMetadata } = await getResourceParents(
    db,
    variable.resourceId,
  );
  const relationshipTargets = await getTargetsWithMetadata();

  const targetId = relationships[variable.reference]?.target.id ?? "";
  const targetResource = relationshipTargets[targetId];
  if (targetResource == null) return variable.defaultValue;

  const isResourceAttribute = variable.path.length === 0;
  if (isResourceAttribute) {
    const resolvedValue = _.get(targetResource, [], variable.defaultValue);
    return resolvedValue;
  }

  const metadataKey = variable.path.join("/");
  const metadataValue = targetResource.metadata[metadataKey];
  return metadataValue ?? variable.defaultValue;
};

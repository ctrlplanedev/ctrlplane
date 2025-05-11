import type * as schema from "@ctrlplane/db/schema";
import _ from "lodash";

import { db } from "@ctrlplane/db/client";
import { getResourceParents } from "@ctrlplane/db/queries";
import { logger } from "@ctrlplane/logger";

export const getReferenceVariableValue = async (
  resourceId: string,
  variable:
    | schema.ReferenceResourceVariable
    | schema.DeploymentVariableValueReference,
) => {
  try {
    const { relationships, getTargetsWithMetadata } = await getResourceParents(
      db,
      resourceId,
    );
    const relationshipTargets = await getTargetsWithMetadata();

    const targetId = relationships[variable.reference]?.target.id ?? "";
    const targetResource = relationshipTargets[targetId];
    if (targetResource == null) return variable.defaultValue;

    return _.get(targetResource, variable.path, variable.defaultValue);
  } catch (error) {
    logger.error("Error resolving reference variable", { error, variable });
    return variable.defaultValue;
  }
};

import type * as schema from "@ctrlplane/db/schema";
import _ from "lodash";

import { db } from "@ctrlplane/db/client";
import { getResourceParents } from "@ctrlplane/db/queries";
import { logger } from "@ctrlplane/logger";

export const getReferenceVariableValue = async (
  resourceId: string,
  variable:
    | schema.ReferenceResourceVariable
    | schema.ReferenceDeploymentVariableValue,
) => {
  try {
    const {
      relationships,
      getParentsWithMetadataAndVars: getParentsWithMetadataAndVars,
    } = await getResourceParents(db, resourceId);
    const relationshipSources = await getParentsWithMetadataAndVars();

    const sourceId = relationships[variable.reference]?.source.id ?? "";
    const sourceResource = relationshipSources[sourceId];
    if (sourceResource == null) return variable.defaultValue ?? null;
    const resolvedPath =
      _.get(sourceResource, variable.path, variable.defaultValue) ?? null;
    return resolvedPath as string | number | boolean | object | null;
  } catch (error) {
    logger.error("Error resolving reference variable", { error, variable });
    return variable.defaultValue ?? null;
  }
};

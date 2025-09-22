import type * as schema from "@ctrlplane/db/schema";
import _ from "lodash";

import { db } from "@ctrlplane/db/client";
import { getResourceParents } from "@ctrlplane/db/queries";
import { logger } from "@ctrlplane/logger";

const log = logger.child({ module: "resolve-reference-variable" });

export const getReferenceVariableValue = async (
  resourceId: string,
  variable:
    | schema.ReferenceResourceVariable
    | schema.ReferenceDeploymentVariableValue,
) => {
  try {
    log.info("resolving reference variable", { variable, resourceId });
    const {
      relationships,
      getParentsWithMetadataAndVars: getParentsWithMetadataAndVars,
    } = await getResourceParents(db, resourceId);
    log.info("got resource parents", { relationships });
    const relationshipSources = await getParentsWithMetadataAndVars();
    log.info("got relationship sources", { relationshipSources });

    const sourceId = relationships[variable.reference]?.source.id ?? "";
    const sourceResource = relationshipSources[sourceId];
    log.info("got source resource", { sourceResource });
    if (sourceResource == null) return variable.defaultValue ?? null;
    const resolvedPath =
      _.get(sourceResource, variable.path, variable.defaultValue) ?? null;
    log.info("got resolved path", { resolvedPath });
    return resolvedPath as string | number | boolean | object | null;
  } catch (error) {
    log.error("Error resolving reference variable", { error, variable });
    return variable.defaultValue ?? null;
  }
};

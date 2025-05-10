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

  return _.get(targetResource, variable.path, variable.defaultValue);
};

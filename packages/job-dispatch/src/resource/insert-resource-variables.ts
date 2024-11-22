import type { Tx } from "@ctrlplane/db";
import type { Resource } from "@ctrlplane/db/schema";
import _ from "lodash";

import { buildConflictUpdateColumns, inArray } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { variablesAES256 } from "@ctrlplane/secrets";

export type ResourceWithVariables = Resource & {
  variables?: Array<{ key: string; value: any; sensitive: boolean }>;
};

export const insertResourceVariables = async (
  tx: Tx,
  resources: ResourceWithVariables[],
) => {
  const resourceIds = resources.map(({ id }) => id);
  const existingVariables = await tx
    .select()
    .from(schema.resourceVariable)
    .where(inArray(schema.resourceVariable.resourceId, resourceIds));

  const resourceVariablesValues = resources.flatMap(({ id, variables = [] }) =>
    variables.map(({ key, value, sensitive }) => ({
      resourceId: id,
      key,
      value: sensitive
        ? variablesAES256().encrypt(JSON.stringify(value))
        : value,
      sensitive,
    })),
  );

  const updatedVariables = await tx
    .insert(schema.resourceVariable)
    .values(resourceVariablesValues)
    .onConflictDoUpdate({
      target: [schema.resourceVariable.key, schema.resourceVariable.resourceId],
      set: buildConflictUpdateColumns(schema.resourceVariable, [
        "value",
        "sensitive",
      ]),
    })
    .returning();

  const created = _.differenceWith(
    updatedVariables,
    existingVariables,
    (a, b) => a.resourceId === b.resourceId && a.key === b.key,
  );

  const deleted = _.differenceWith(
    existingVariables,
    updatedVariables,
    (a, b) => a.resourceId === b.resourceId && a.key === b.key,
  );

  const updated = _.intersectionWith(
    updatedVariables,
    existingVariables,
    (a, b) =>
      a.resourceId === b.resourceId &&
      a.key === b.key &&
      (a.value !== b.value || a.sensitive !== b.sensitive),
  );

  return { created, deleted, updated };
};

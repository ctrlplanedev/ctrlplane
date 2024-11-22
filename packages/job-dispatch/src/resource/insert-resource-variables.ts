import type { Tx } from "@ctrlplane/db";
import type { Resource } from "@ctrlplane/db/schema";
import _ from "lodash";

import { buildConflictUpdateColumns } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { variablesAES256 } from "@ctrlplane/secrets";

export type ResourceWithVariables = Resource & {
  variables?: Array<{ key: string; value: any; sensitive: boolean }>;
};

export const insertResourceVariables = async (
  tx: Tx,
  resources: ResourceWithVariables[],
) => {
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

  return tx
    .insert(schema.resourceVariable)
    .values(resourceVariablesValues)
    .onConflictDoUpdate({
      target: [schema.resourceVariable.key, schema.resourceVariable.resourceId],
      set: buildConflictUpdateColumns(schema.resourceVariable, [
        "value",
        "sensitive",
      ]),
    });
};

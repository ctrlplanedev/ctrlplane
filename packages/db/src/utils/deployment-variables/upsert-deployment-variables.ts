import type { z } from "zod";
import { eq } from "drizzle-orm/pg-core/expressions";

import type { Tx } from "../../common.js";
import { db } from "../../client.js";
import { buildConflictUpdateColumns, takeFirst } from "../../common.js";
import * as schema from "../../schema/index.js";
import { upsertDirectVariableValue } from "./upsert-direct-value.js";
import { upsertReferenceVariableValue } from "./upsert-reference-value.js";

type CreateDeploymentVariable = z.infer<typeof schema.createDeploymentVariable>;

const upsertVariable = (
  tx: Tx,
  insertVariable: schema.InsertDeploymentVariable,
) =>
  tx
    .insert(schema.deploymentVariable)
    .values(insertVariable)
    .onConflictDoUpdate({
      target: [
        schema.deploymentVariable.deploymentId,
        schema.deploymentVariable.key,
      ],
      set: buildConflictUpdateColumns(schema.deploymentVariable, [
        "description",
        "config",
      ]),
    })
    .returning()
    .then(takeFirst);

const setDefaultVariableValue = (tx: Tx, variableId: string, valueId: string) =>
  tx
    .update(schema.deploymentVariable)
    .set({ defaultValueId: valueId })
    .where(eq(schema.deploymentVariable.id, variableId));

const checkOnlyOneDefault = (
  directValues: schema.CreateDirectDeploymentVariableValue[],
  referenceValues: schema.CreateReferenceDeploymentVariableValue[],
) => {
  const defaultDirectValues = directValues.filter((dv) => dv.isDefault).length;
  const defaultReferenceValues = referenceValues.filter(
    (rv) => rv.isDefault,
  ).length;
  const numDefault = defaultDirectValues + defaultReferenceValues;
  if (numDefault > 1) throw new Error("Only one default value is allowed");
};

export const upsertDeploymentVariable = async (
  deploymentId: string,
  createVariable: CreateDeploymentVariable,
): Promise<
  schema.DeploymentVariable & {
    directValues: schema.DirectDeploymentVariableValue[];
    referenceValues: schema.ReferenceDeploymentVariableValue[];
  }
> =>
  db.transaction(async (tx) => {
    const { directValues, referenceValues, ...rest } = createVariable;
    checkOnlyOneDefault(directValues ?? [], referenceValues ?? []);

    const variable = await upsertVariable(tx, { ...rest, deploymentId });

    const directValuePromises = (directValues ?? []).map(async (dv) => {
      const value = await upsertDirectVariableValue(tx, variable.id, dv);
      if (dv.isDefault)
        await setDefaultVariableValue(tx, variable.id, value.id);
      return value;
    });
    const insertedDirectValues = await Promise.all(directValuePromises);

    const referenceValuePromises = (referenceValues ?? []).map(async (rv) => {
      const value = await upsertReferenceVariableValue(tx, variable.id, rv);
      if (rv.isDefault)
        await setDefaultVariableValue(tx, variable.id, value.id);
      return value;
    });
    const insertedReferenceValues = await Promise.all(referenceValuePromises);

    const finalVariable = await tx
      .select()
      .from(schema.deploymentVariable)
      .where(eq(schema.deploymentVariable.id, variable.id))
      .then(takeFirst);

    return {
      ...finalVariable,
      directValues: insertedDirectValues,
      referenceValues: insertedReferenceValues,
    };
  });

import { and, eq } from "drizzle-orm";

import type { Tx } from "../../common.js";
import { takeFirst, takeFirstOrNull } from "../../common.js";
import * as schema from "../../schema/index.js";

const getExistingReferenceVariableValue = (
  tx: Tx,
  variableId: string,
  reference: string,
  path: string[],
) =>
  tx
    .select()
    .from(schema.deploymentVariableValue)
    .innerJoin(
      schema.deploymentVariableValueReference,
      eq(
        schema.deploymentVariableValueReference.variableValueId,
        schema.deploymentVariableValue.id,
      ),
    )
    .where(
      and(
        eq(schema.deploymentVariableValue.variableId, variableId),
        eq(schema.deploymentVariableValueReference.reference, reference),
        eq(schema.deploymentVariableValueReference.path, path),
      ),
    )
    .then(takeFirstOrNull);

const insertNewReferenceVariableValue = async (
  tx: Tx,
  variableId: string,
  insertReferenceValue: schema.CreateReferenceDeploymentVariableValue,
): Promise<schema.ReferenceDeploymentVariableValue> => {
  const insertedVariableValue = await tx
    .insert(schema.deploymentVariableValue)
    .values({
      variableId,
      resourceSelector: insertReferenceValue.resourceSelector,
    })
    .returning()
    .then(takeFirst);

  const insertedReferenceValue = await tx
    .insert(schema.deploymentVariableValueReference)
    .values({
      variableValueId: insertedVariableValue.id,
      reference: insertReferenceValue.reference,
      path: insertReferenceValue.path,
      defaultValue: insertReferenceValue.defaultValue,
    })
    .returning()
    .then(takeFirst);

  return { ...insertedReferenceValue, ...insertedVariableValue };
};

const updateExistingReferenceVariableValue = async (
  tx: Tx,
  variableValueId: string,
  updateReferenceValue: schema.CreateReferenceDeploymentVariableValue,
) => {
  const updatedVariableValue = await tx
    .update(schema.deploymentVariableValue)
    .set({ resourceSelector: updateReferenceValue.resourceSelector })
    .where(eq(schema.deploymentVariableValue.id, variableValueId))
    .returning()
    .then(takeFirst);

  const updatedReferenceValue = await tx
    .update(schema.deploymentVariableValueReference)
    .set({
      reference: updateReferenceValue.reference,
      path: updateReferenceValue.path,
      defaultValue: updateReferenceValue.defaultValue,
    })
    .where(
      eq(
        schema.deploymentVariableValueReference.variableValueId,
        variableValueId,
      ),
    )
    .returning()
    .then(takeFirst);

  return { ...updatedReferenceValue, ...updatedVariableValue };
};

export const upsertReferenceVariableValue = async (
  tx: Tx,
  variableId: string,
  insertReferenceValue: schema.CreateReferenceDeploymentVariableValue,
) => {
  const existingValue = await getExistingReferenceVariableValue(
    tx,
    variableId,
    insertReferenceValue.reference,
    insertReferenceValue.path,
  );

  if (existingValue == null)
    return insertNewReferenceVariableValue(
      tx,
      variableId,
      insertReferenceValue,
    );

  return updateExistingReferenceVariableValue(
    tx,
    existingValue.deployment_variable_value.id,
    insertReferenceValue,
  );
};

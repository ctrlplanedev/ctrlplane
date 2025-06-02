import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";

import { variablesAES256 } from "@ctrlplane/secrets";

import type { Tx } from "../../common.js";
import { takeFirst, takeFirstOrNull } from "../../common.js";
import * as schema from "../../schema/index.js";

const getExistingDirectVariableValue = (
  tx: Tx,
  variableId: string,
  valueHash: string,
) =>
  tx
    .select()
    .from(schema.deploymentVariableValue)
    .innerJoin(
      schema.deploymentVariableValueDirect,
      eq(
        schema.deploymentVariableValueDirect.variableValueId,
        schema.deploymentVariableValue.id,
      ),
    )
    .where(
      and(
        eq(schema.deploymentVariableValue.variableId, variableId),
        eq(schema.deploymentVariableValueDirect.valueHash, valueHash),
      ),
    )
    .then(takeFirstOrNull);

const getValueAndHash = (
  value: string | number | boolean | object | null,
  sensitive: boolean,
) => {
  const stringifiedValue =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  const valueHash = createHash("md5")
    .update(stringifiedValue, "utf8")
    .digest("hex");

  const maybeEncryptedValue = sensitive
    ? variablesAES256().encrypt(stringifiedValue)
    : value;

  return { value: maybeEncryptedValue, valueHash };
};

const insertNewDirectVariableValue = async (
  tx: Tx,
  variableId: string,
  insertDirectValue: schema.CreateDirectDeploymentVariableValue,
): Promise<schema.DirectDeploymentVariableValue> => {
  const { value, valueHash } = getValueAndHash(
    insertDirectValue.value,
    insertDirectValue.sensitive,
  );

  const insertedVariableValue = await tx
    .insert(schema.deploymentVariableValue)
    .values({
      variableId,
      resourceSelector: insertDirectValue.resourceSelector,
    })
    .returning()
    .then(takeFirst);

  const insertedDirectValue = await tx
    .insert(schema.deploymentVariableValueDirect)
    .values({
      variableValueId: insertedVariableValue.id,
      value,
      valueHash,
      sensitive: insertDirectValue.sensitive,
    })
    .returning()
    .then(takeFirst);

  return { ...insertedDirectValue, ...insertedVariableValue };
};

const updateExistingDirectVariableValue = async (
  tx: Tx,
  variableValueId: string,
  updateDirectValue: schema.CreateDirectDeploymentVariableValue,
): Promise<schema.DirectDeploymentVariableValue> => {
  const { value, valueHash } = getValueAndHash(
    updateDirectValue.value,
    updateDirectValue.sensitive,
  );

  const updatedVariableValue = await tx
    .update(schema.deploymentVariableValue)
    .set({ resourceSelector: updateDirectValue.resourceSelector })
    .where(eq(schema.deploymentVariableValue.id, variableValueId))
    .returning()
    .then(takeFirst);

  const updatedDirectValue = await tx
    .update(schema.deploymentVariableValueDirect)
    .set({
      value,
      valueHash,
      sensitive: updateDirectValue.sensitive,
    })
    .where(
      eq(schema.deploymentVariableValueDirect.variableValueId, variableValueId),
    )
    .returning()
    .then(takeFirst);

  return { ...updatedDirectValue, ...updatedVariableValue };
};

export const upsertDirectVariableValue = async (
  tx: Tx,
  variableId: string,
  insertDirectValue: schema.CreateDirectDeploymentVariableValue,
) => {
  const { valueHash } = getValueAndHash(
    insertDirectValue.value,
    insertDirectValue.sensitive,
  );

  const existingValue = await getExistingDirectVariableValue(
    tx,
    variableId,
    valueHash,
  );

  if (existingValue == null)
    return insertNewDirectVariableValue(tx, variableId, insertDirectValue);

  return updateExistingDirectVariableValue(
    tx,
    existingValue.deployment_variable_value.id,
    insertDirectValue,
  );
};

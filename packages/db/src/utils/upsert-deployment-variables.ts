import { createHash } from "crypto";
import type { z } from "zod";
import { eq } from "drizzle-orm/pg-core/expressions";
import { isPresent } from "ts-is-present";

import { logger } from "@ctrlplane/logger";
import { variablesAES256 } from "@ctrlplane/secrets";

import type { Tx } from "../common.js";
import { db } from "../client.js";
import { buildConflictUpdateColumns, takeFirst } from "../common.js";
import * as schema from "../schema/index.js";

type CreateDeploymentVariable = z.infer<typeof schema.createDeploymentVariable>;

const log = logger.child({ function: "upsertDeploymentVariableWithValues" });

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

const upsertDirectVariableValue = (
  tx: Tx,
  insertDirectValue: schema.InsertDeploymentVariableValueDirect,
) => {
  const valueHash = createHash("md5")
    .update(JSON.stringify(insertDirectValue.value), "utf8")
    .digest("hex");

  const strVal =
    typeof insertDirectValue.value === "object"
      ? JSON.stringify(insertDirectValue.value)
      : String(insertDirectValue.value);

  const value = insertDirectValue.sensitive
    ? variablesAES256().encrypt(strVal)
    : strVal;

  return tx
    .insert(schema.deploymentVariableValue)
    .values({ ...insertDirectValue, value, valueHash })
    .onConflictDoUpdate({
      target: [
        schema.deploymentVariableValue.variableId,
        schema.deploymentVariableValue.valueHash,
      ],
      set: buildConflictUpdateColumns(schema.deploymentVariableValue, [
        "value",
        "sensitive",
        "resourceSelector",
      ]),
    })
    .returning()
    .then(takeFirst);
};

const upsertReferenceVariableValue = (
  tx: Tx,
  insertReferenceValue: schema.InsertDeploymentVariableValueReference,
) =>
  tx
    .insert(schema.deploymentVariableValue)
    .values(insertReferenceValue)
    .onConflictDoUpdate({
      target: [
        schema.deploymentVariableValue.variableId,
        schema.deploymentVariableValue.reference,
        schema.deploymentVariableValue.path,
      ],
      set: buildConflictUpdateColumns(schema.deploymentVariableValue, [
        "resourceSelector",
      ]),
    })
    .returning()
    .then(takeFirst);

export const upsertVariableValue = async (
  tx: Tx,
  variableValueInsert: schema.InsertDeploymentVariableValue,
) => {
  const { variableId } = variableValueInsert;
  const isDirectValue =
    schema.isInsertDeploymentVariableValueDirect(variableValueInsert);
  if (isDirectValue) {
    const value = await upsertDirectVariableValue(tx, variableValueInsert);
    if (variableValueInsert.isDefault)
      await setDefaultVariableValue(tx, variableId, value.id);
    return value;
  }

  const isReferenceValue =
    schema.isInsertDeploymentVariableValueReference(variableValueInsert);
  if (isReferenceValue) {
    const value = await upsertReferenceVariableValue(tx, variableValueInsert);
    if (variableValueInsert.isDefault)
      await setDefaultVariableValue(tx, variableId, value.id);
    return value;
  }

  log.error("Unknown variable value type", { variableValueInsert });
  return null;
};

const setDefaultVariableValue = (tx: Tx, variableId: string, valueId: string) =>
  tx
    .update(schema.deploymentVariable)
    .set({ defaultValueId: valueId })
    .where(eq(schema.deploymentVariable.id, variableId));

export const upsertDeploymentVariable = async (
  deploymentId: string,
  createVariable: CreateDeploymentVariable,
): Promise<
  schema.DeploymentVariable & { values: schema.DeploymentVariableValue[] }
> =>
  db.transaction(async (tx) => {
    const { values, ...rest } = createVariable;

    const variable = await upsertVariable(tx, { ...rest, deploymentId });
    if (values == null) return { ...variable, values: [] };

    const valueInsertionPromises = values.map((v) =>
      upsertVariableValue(tx, { ...v, variableId: variable.id }),
    );

    const insertedValues = await Promise.all(valueInsertionPromises).then(
      (values) => values.filter(isPresent),
    );

    return { ...variable, values: insertedValues };
  });

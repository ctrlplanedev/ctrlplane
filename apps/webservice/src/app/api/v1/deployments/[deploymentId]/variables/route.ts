import type { Tx } from "@ctrlplane/db";
import type { z } from "zod";
import { NextResponse } from "next/server";
import { CREATED, INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";

import {
  eq,
  getDeploymentVariables,
  takeFirstOrNull,
  upsertDeploymentVariable,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { getResolvedDirectValue } from "@ctrlplane/rule-engine";
import { variablesAES256 } from "@ctrlplane/secrets";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { parseBody } from "~/app/api/v1/body-parser";
import { request } from "~/app/api/v1/middleware";
import { getExistingVariable, isVariableChanged } from "./variable-diff-check";

const log = logger.child({
  route: "/v1/deployments/[deploymentId]/variables",
});

const formatDefaultValue = (v?: schema.DeploymentVariableValue) => {
  if (v == null) return undefined;
  if (schema.isDeploymentVariableValueReference(v)) return v;
  return {
    ...v,
    value: getResolvedDirectValue(v),
  };
};

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.DeploymentGet)
        .on({ type: "deployment", id: params.deploymentId ?? "" }),
    ),
  )
  .handle<{ db: Tx }, { params: Promise<{ deploymentId: string }> }>(
    async ({ db }, { params }) => {
      try {
        const { deploymentId } = await params;
        const deployment = await db.query.deployment.findFirst({
          where: eq(schema.deployment.id, deploymentId),
        });

        if (deployment == null)
          return NextResponse.json(
            { error: "Deployment not found" },
            { status: NOT_FOUND },
          );

        const variables = await getDeploymentVariables(db, deploymentId);
        const variablesWithDecryptedValues = variables.map((v) => {
          const { values, defaultValue, ...rest } = v;
          const directValues = values.filter(
            schema.isDeploymentVariableValueDirect,
          );
          const referenceValues = values.filter(
            schema.isDeploymentVariableValueReference,
          );

          const formattedDirectValues = directValues.map((v) => ({
            ...v,
            value: getResolvedDirectValue(v),
            isDefault: rest.id === defaultValue?.id,
          }));

          const formattedReferenceValues = referenceValues.map((v) => ({
            ...v,
            isDefault: rest.id === defaultValue?.id,
          }));

          return {
            ...rest,
            directValues: formattedDirectValues,
            referenceValues: formattedReferenceValues,
            defaultValue: formatDefaultValue(defaultValue),
          };
        });

        return NextResponse.json(variablesWithDecryptedValues);
      } catch (e) {
        log.error("Failed to fetch deployment variables", { error: e });
        return NextResponse.json(
          { error: "Failed to fetch deployment variables" },
          { status: INTERNAL_SERVER_ERROR },
        );
      }
    },
  );

const getDefaultValue = async (db: Tx, variable: schema.DeploymentVariable) => {
  const { defaultValueId } = variable;
  if (defaultValueId == null) return undefined;

  const defaultDirectValue = await db
    .select()
    .from(schema.deploymentVariableValue)
    .innerJoin(
      schema.deploymentVariableValueDirect,
      eq(
        schema.deploymentVariableValueDirect.variableValueId,
        schema.deploymentVariableValue.id,
      ),
    )
    .where(eq(schema.deploymentVariableValue.id, defaultValueId))
    .then(takeFirstOrNull);

  if (defaultDirectValue != null) {
    const value = defaultDirectValue.deployment_variable_value_direct.sensitive
      ? variablesAES256().decrypt(
          String(defaultDirectValue.deployment_variable_value_direct.value),
        )
      : defaultDirectValue.deployment_variable_value_direct.value;
    return {
      ...defaultDirectValue.deployment_variable_value_direct,
      ...defaultDirectValue.deployment_variable_value,
      value,
    };
  }

  const defaultReferenceValue = await db
    .select()
    .from(schema.deploymentVariableValue)
    .innerJoin(
      schema.deploymentVariableValueReference,
      eq(
        schema.deploymentVariableValueReference.variableValueId,
        schema.deploymentVariableValue.id,
      ),
    )
    .where(eq(schema.deploymentVariableValue.id, defaultValueId))
    .then(takeFirstOrNull);

  if (defaultReferenceValue == null) return null;

  return {
    ...defaultReferenceValue.deployment_variable_value_reference,
    ...defaultReferenceValue.deployment_variable_value,
  };
};

export const POST = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.DeploymentUpdate)
        .on({ type: "deployment", id: params.deploymentId ?? "" }),
    ),
  )
  .use(parseBody(schema.createDeploymentVariable))
  .handle<
    { db: Tx; body: z.infer<typeof schema.createDeploymentVariable> },
    { params: Promise<{ deploymentId: string }> }
  >(async ({ db, body }, { params }) => {
    try {
      const { deploymentId } = await params;

      const deployment = await db.query.deployment.findFirst({
        where: eq(schema.deployment.id, deploymentId),
      });

      if (deployment == null)
        return NextResponse.json(
          { error: "Deployment not found" },
          { status: NOT_FOUND },
        );

      const existingVariable = await getExistingVariable(
        deploymentId,
        body.key,
      );

      const variable = await upsertDeploymentVariable(deploymentId, body);

      if (existingVariable == null)
        await eventDispatcher.dispatchDeploymentVariableCreated(variable);
      if (
        existingVariable != null &&
        isVariableChanged(existingVariable, variable)
      )
        await eventDispatcher.dispatchDeploymentVariableUpdated(
          existingVariable,
          variable,
        );

      const defaultValue = await getDefaultValue(db, variable);

      return NextResponse.json(
        { ...variable, defaultValue },
        { status: CREATED },
      );
    } catch (e) {
      log.error("Failed to create deployment variable", { error: e });
      return NextResponse.json(
        { error: "Failed to create deployment variable" },
        { status: INTERNAL_SERVER_ERROR },
      );
    }
  });

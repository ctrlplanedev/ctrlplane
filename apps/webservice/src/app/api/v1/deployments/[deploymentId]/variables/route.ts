import type { Tx } from "@ctrlplane/db";
import type { z } from "zod";
import { NextResponse } from "next/server";
import { CREATED, INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";

import {
  eq,
  getDeploymentVariables,
  getResolvedDirectValue,
  takeFirstOrNull,
  upsertDeploymentVariable,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { variablesAES256 } from "@ctrlplane/secrets";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { parseBody } from "~/app/api/v1/body-parser";
import { request } from "~/app/api/v1/middleware";

const log = logger.child({
  route: "/v1/deployments/[deploymentId]/variables",
});

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
          const { directValues, ...rest } = v;
          const resolvedDirectValues = directValues.map((dv) => ({
            ...dv,
            value: getResolvedDirectValue(dv),
          }));
          return { ...rest, directValues: resolvedDirectValues };
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

      const variable = await upsertDeploymentVariable(deploymentId, body);

      await getQueue(Channel.UpdateDeploymentVariable).add(
        variable.id,
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

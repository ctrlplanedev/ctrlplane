import type { Tx } from "@ctrlplane/db";
import type { z } from "zod";
import { NextResponse } from "next/server";
import { CREATED, INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";
import { isPresent } from "ts-is-present";

import { eq, upsertDeploymentVariable } from "@ctrlplane/db";
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

const resolveDirectValue = (val: schema.DeploymentVariableValueDirect) => {
  const { id, value, valueType, sensitive, resourceSelector } = val;
  const strVal =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  const resolvedValue = sensitive ? variablesAES256().decrypt(strVal) : value;
  return { id, value: resolvedValue, valueType, resourceSelector, sensitive };
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

        const variablesResult = await db.query.deploymentVariable.findMany({
          where: eq(schema.deploymentVariable.deploymentId, deploymentId),
          with: { values: true },
        });

        const variables = variablesResult.map((v) => {
          const { values, defaultValueId, deploymentId: _, ...rest } = v;
          const resolvedValues = values
            .map((val) => {
              const isDirect = schema.isDeploymentVariableValueDirect(val);
              if (isDirect) return resolveDirectValue(val);
              const isReference =
                schema.isDeploymentVariableValueReference(val);
              if (isReference) return val;
              log.error("Invalid variable value type", { value: val });
              return null;
            })
            .filter(isPresent);

          const defaultValue = resolvedValues.find(
            (v) => v.id === defaultValueId,
          );
          return { ...rest, values: resolvedValues, defaultValue };
        });

        return NextResponse.json(variables);
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

  const defaultValue = await db.query.deploymentVariableValue.findFirst({
    where: eq(schema.deploymentVariableValue.id, defaultValueId),
  });

  if (defaultValue == null) return undefined;

  const { value, ...rest } = defaultValue;

  const resolvedValue = defaultValue.sensitive
    ? variablesAES256().decrypt(String(value))
    : value;
  return { ...rest, value: resolvedValue };
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

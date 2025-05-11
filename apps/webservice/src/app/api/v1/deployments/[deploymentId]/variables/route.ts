import type { Tx } from "@ctrlplane/db";
import type { z } from "zod";
import { NextResponse } from "next/server";
import { CREATED, INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";
import { isPresent } from "ts-is-present";

import { eq, takeFirst } from "@ctrlplane/db";
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

      const { values, ...rest } = body;

      const variable = await db.transaction(async (tx) => {
        const variable = await tx
          .insert(schema.deploymentVariable)
          .values({ ...rest, deploymentId })
          .returning()
          .then(takeFirst);

        const insertPromises = (values ?? []).map(async (v) => {
          const { default: isDefault, ...rest } = v;
          const val = rest.sensitive
            ? variablesAES256().encrypt(String(rest.value))
            : rest.value;

          const inserted = await tx
            .insert(schema.deploymentVariableValue)
            .values({ ...rest, value: val, variableId: variable.id })
            .returning()
            .then(takeFirst);

          if (isDefault)
            await tx
              .update(schema.deploymentVariable)
              .set({ defaultValueId: inserted.id })
              .where(eq(schema.deploymentVariable.id, variable.id));

          const strVal = String(inserted.value);
          const resolvedValue = inserted.sensitive
            ? variablesAES256().decrypt(strVal)
            : strVal;

          const { variableId: _, ...variableValue } = inserted;
          return { ...variableValue, value: resolvedValue };
        });

        const insertedValues = await Promise.all(insertPromises);
        return { ...variable, values: insertedValues };
      });

      await getQueue(Channel.UpdateDeploymentVariable).add(
        variable.id,
        variable,
      );

      const defaultValue =
        variable.defaultValueId != null
          ? await db.query.deploymentVariableValue
              .findFirst({
                where: eq(
                  schema.deploymentVariableValue.id,
                  variable.defaultValueId,
                ),
              })
              .then((v) => {
                if (v == null) return undefined;
                const { value, ...rest } = v;
                const strVal = String(value);
                const resolvedValue = v.sensitive
                  ? variablesAES256().decrypt(strVal)
                  : strVal;
                return { ...rest, value: resolvedValue };
              })
          : undefined;

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

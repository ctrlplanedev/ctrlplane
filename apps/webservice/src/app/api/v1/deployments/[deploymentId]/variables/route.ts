import type { Tx } from "@ctrlplane/db";
import type { z } from "zod";
import { NextResponse } from "next/server";
import { INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";

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
          const resolvedValues = values.map((val) => {
            const { id, value, sensitive, resourceSelector } = val;
            const strVal = String(value);
            const resolvedValue = sensitive
              ? variablesAES256().decrypt(strVal)
              : strVal;
            return {
              id,
              value: resolvedValue,
              resourceSelector,
              sensitive,
            };
          });

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
          .values(rest)
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

          const { variableId: _, ...variableValue } = inserted;
          return variableValue;
        });

        const insertedValues = await Promise.all(insertPromises);
        return { ...variable, values: insertedValues };
      });

      await getQueue(Channel.UpdateDeploymentVariable).add(
        variable.id,
        variable,
      );

      return NextResponse.json(variable);
    } catch (e) {
      log.error("Failed to create deployment variable", { error: e });
      return NextResponse.json(
        { error: "Failed to create deployment variable" },
        { status: INTERNAL_SERVER_ERROR },
      );
    }
  });

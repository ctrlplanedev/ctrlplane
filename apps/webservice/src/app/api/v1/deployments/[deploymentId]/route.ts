import type { Tx } from "@ctrlplane/db";
import type { z } from "zod";
import { NextResponse } from "next/server";
import httpStatus from "http-status";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { upsertExitHook } from "../_utils/upsertExitHook";
import { authn, authz } from "../../auth";
import { parseBody } from "../../body-parser";
import { request } from "../../middleware";

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
      const { deploymentId } = await params;
      const deployment = await db
        .select()
        .from(SCHEMA.deployment)
        .where(eq(SCHEMA.deployment.id, deploymentId))
        .then(takeFirstOrNull);

      if (deployment == null)
        return NextResponse.json(
          { error: "Deployment not found" },
          { status: httpStatus.NOT_FOUND },
        );

      return NextResponse.json(deployment);
    },
  );

export const DELETE = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.DeploymentDelete)
        .on({ type: "deployment", id: params.deploymentId ?? "" }),
    ),
  )
  .handle<{ db: Tx }, { params: Promise<{ deploymentId: string }> }>(
    async ({ db }, { params }) => {
      try {
        const { deploymentId } = await params;
        const deployment = await db
          .select()
          .from(SCHEMA.deployment)
          .where(eq(SCHEMA.deployment.id, deploymentId))
          .then(takeFirstOrNull);

        if (deployment == null)
          return NextResponse.json(
            { error: "Deployment not found" },
            { status: httpStatus.NOT_FOUND },
          );

        await db
          .delete(SCHEMA.deployment)
          .where(eq(SCHEMA.deployment.id, deploymentId));

        return NextResponse.json(deployment);
      } catch (error) {
        logger.error("Failed to delete deployment", { error });
        return NextResponse.json(
          { error: "Failed to delete deployment" },
          { status: httpStatus.INTERNAL_SERVER_ERROR },
        );
      }
    },
  );

export const PATCH = request()
  .use(authn)
  .use(
    authz(({ can, params }) => {
      return can
        .perform(Permission.DeploymentUpdate)
        .on({ type: "deployment", id: params.deploymentId ?? "" });
    }),
  )
  .use(parseBody(SCHEMA.updateDeployment))
  .handle<
    { db: Tx; body: z.infer<typeof SCHEMA.updateDeployment> },
    { params: Promise<{ deploymentId: string }> }
  >(async ({ db, body }, { params }) => {
    try {
      const { deploymentId } = await params;

      const deployment = await db
        .select()
        .from(SCHEMA.deployment)
        .where(eq(SCHEMA.deployment.id, deploymentId))
        .then(takeFirstOrNull);

      if (deployment == null)
        return NextResponse.json(
          { error: "Deployment not found" },
          { status: httpStatus.NOT_FOUND },
        );

      const updatedDeployment = await db
        .update(SCHEMA.deployment)
        .set(body)
        .where(eq(SCHEMA.deployment.id, deploymentId))
        .returning()
        .then(takeFirst);

      const { exitHooks } = body;
      if (exitHooks != null)
        for (const eh of exitHooks)
          await upsertExitHook(db, updatedDeployment, eh);

      await getQueue(Channel.UpdateDeployment).add(updatedDeployment.id, {
        new: updatedDeployment,
        old: deployment,
      });

      return NextResponse.json(updatedDeployment);
    } catch (error) {
      logger.error("Failed to update deployment", { error: error });
      return NextResponse.json(
        { error: "Failed to update deployment" },
        { status: httpStatus.INTERNAL_SERVER_ERROR },
      );
    }
  });

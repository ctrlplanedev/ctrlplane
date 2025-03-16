import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import httpStatus from "http-status";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../auth";
import { request } from "../../middleware";

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, extra: { params } }) =>
      can
        .perform(Permission.DeploymentGet)
        .on({ type: "deployment", id: params.deploymentId }),
    ),
  )
  .handle<{ db: Tx }, { params: { deploymentId: string } }>(
    async ({ db }, { params }) => {
      const deployment = await db
        .select()
        .from(SCHEMA.deployment)
        .where(eq(SCHEMA.deployment.id, params.deploymentId))
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
    authz(({ can, extra: { params } }) =>
      can
        .perform(Permission.DeploymentDelete)
        .on({ type: "deployment", id: params.deploymentId }),
    ),
  )
  .handle<{ db: Tx }, { params: { deploymentId: string } }>(
    async ({ db }, { params }) => {
      try {
        const deployment = await db
          .select()
          .from(SCHEMA.deployment)
          .where(eq(SCHEMA.deployment.id, params.deploymentId))
          .then(takeFirstOrNull);

        if (deployment == null)
          return NextResponse.json(
            { error: "Deployment not found" },
            { status: httpStatus.NOT_FOUND },
          );

        await db
          .delete(SCHEMA.deployment)
          .where(eq(SCHEMA.deployment.id, params.deploymentId));

        return NextResponse.json({ deployment, message: "Deployment deleted" });
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
    authz(async ({ can, extra: { params } }) => {
      return can
        .perform(Permission.DeploymentUpdate)
        .on({ type: "deployment", id: (await params).deploymentId });
    }),
  )
  .handle<{ db: Tx }, { params: Promise<{ deploymentId: string }> }>(
    async ({ db, req }, { params }) => {
      try {
        const deploymentId = (await params).deploymentId;

        const body = await req.json();

        const result = SCHEMA.updateDeployment.safeParse(body);
        if (!result.success)
          return NextResponse.json(
            {
              error: "Invalid request data",
              details: result.error.format(),
            },
            { status: httpStatus.BAD_REQUEST },
          );

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
          .then(takeFirstOrNull);

        return NextResponse.json(updatedDeployment);
      } catch (error) {
        logger.error("Failed to update deployment", { error: error });
        return NextResponse.json(
          { error: "Failed to update deployment" },
          { status: httpStatus.INTERNAL_SERVER_ERROR },
        );
      }
    },
  );

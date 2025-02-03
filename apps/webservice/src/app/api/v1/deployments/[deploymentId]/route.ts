import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import httpStatus from "http-status";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
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
    async (ctx, { params }) => {
      const deployment = await ctx.db
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
    async (ctx, { params }) => {
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

        await ctx.db
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

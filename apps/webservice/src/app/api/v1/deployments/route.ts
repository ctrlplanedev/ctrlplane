import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import httpStatus from "http-status";
import { z } from "zod";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const log = logger.child({ module: "api/v1/deployments" });

export const POST = request()
  .use(authn)
  .use(parseBody(SCHEMA.createDeployment))
  .use(
    authz(({ ctx, can }) =>
      can
        .perform(Permission.DeploymentCreate)
        .on({ type: "system", id: ctx.body.systemId }),
    ),
  )
  .handle<{ db: Tx; body: SCHEMA.CreateDeployment }>(async (ctx) => {
    const existingDeployment = await ctx.db
      .select()
      .from(SCHEMA.deployment)
      .where(
        and(
          eq(SCHEMA.deployment.systemId, ctx.body.systemId),
          eq(SCHEMA.deployment.slug, ctx.body.slug),
        ),
      )
      .then(takeFirstOrNull);

    if (existingDeployment != null)
      return NextResponse.json(
        { error: "Deployment already exists", id: existingDeployment.id },
        { status: httpStatus.CONFLICT },
      );

    try {
      const deployment = await ctx.db
        .insert(SCHEMA.deployment)
        .values({ ...ctx.body, description: ctx.body.description ?? "" })
        .returning()
        .then(takeFirst);

      return NextResponse.json(deployment, { status: httpStatus.CREATED });
    } catch (error) {
      logger.error("Failed to create deployment", { error });
      return NextResponse.json(
        { error: "Failed to create deployment" },
        { status: httpStatus.INTERNAL_SERVER_ERROR },
      );
    }
  });

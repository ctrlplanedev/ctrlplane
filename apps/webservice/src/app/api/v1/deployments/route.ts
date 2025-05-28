import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import httpStatus from "http-status";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";
import { upsertExitHook } from "./_utils/upsertExitHook";

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
    try {
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

      const { exitHooks } = ctx.body;

      if (existingDeployment != null) {
        // Update existing deployment
        const updatedDeployment = await ctx.db
          .update(SCHEMA.deployment)
          .set(ctx.body)
          .where(eq(SCHEMA.deployment.id, existingDeployment.id))
          .returning()
          .then(takeFirst);

        await getQueue(Channel.UpdateDeployment).add(updatedDeployment.id, {
          new: updatedDeployment,
          old: existingDeployment,
        });

        if (exitHooks != null)
          await Promise.all(
            exitHooks.map((eh) =>
              upsertExitHook(ctx.db, updatedDeployment, eh),
            ),
          );

        return NextResponse.json(updatedDeployment, { status: httpStatus.OK });
      }

      // Create new deployment
      const newDeployment = await ctx.db
        .insert(SCHEMA.deployment)
        .values({ ...ctx.body, description: ctx.body.description ?? "" })
        .returning()
        .then(takeFirst);

      if (exitHooks != null)
        await Promise.all(
          exitHooks.map((eh) => upsertExitHook(ctx.db, newDeployment, eh)),
        );

      await getQueue(Channel.NewDeployment).add(
        newDeployment.id,
        newDeployment,
      );

      return NextResponse.json(newDeployment, { status: httpStatus.CREATED });
    } catch (error) {
      logger.error("Failed to upsert deployment", { error });
      return NextResponse.json(
        { error: "Failed to upsert deployment" },
        { status: httpStatus.INTERNAL_SERVER_ERROR },
      );
    }
  });

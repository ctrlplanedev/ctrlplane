import type { PermissionChecker } from "@ctrlplane/auth/utils";
import type { User } from "@ctrlplane/db/schema";
import { NextResponse } from "next/server";
import _ from "lodash";
import { z } from "zod";

import { and, createEnv, eq, inArray } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { createJobsForNewEnvironment } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const body = schema.createEnvironment.extend({
  releaseChannels: z.array(z.string()),
  expiresAt: z.coerce
    .date()
    .min(new Date(), "Expires at must be in the future")
    .optional(),
});

export const POST = request()
  .use(authn)
  .use(parseBody(body))
  .use(
    authz(({ ctx, can }) =>
      can
        .perform(Permission.SystemUpdate)
        .on({ type: "system", id: ctx.body.systemId }),
    ),
  )
  .handle<{ user: User; can: PermissionChecker; body: z.infer<typeof body> }>(
    async (ctx) => {
      const isInSystem = eq(schema.environment.systemId, ctx.body.systemId);
      const isSameName = eq(schema.environment.name, ctx.body.name);
      const existingEnvironment = await ctx.db.query.environment.findFirst({
        where: and(isInSystem, isSameName),
      });

      if (existingEnvironment != null)
        return NextResponse.json(
          { error: "Environment already exists", id: existingEnvironment.id },
          { status: 409 },
        );

      try {
        return ctx.db.transaction(async (tx) => {
          const {
            releaseChannels: deploymentVersionChannels,
            metadata,
            ...rest
          } = ctx.body;

          const channels = await tx
            .select()
            .from(schema.deploymentVersionChannel)
            .where(
              inArray(
                schema.deploymentVersionChannel.id,
                deploymentVersionChannels,
              ),
            )
            .then((rows) =>
              _.uniqBy(rows, (r) => r.deploymentId).map((r) => ({
                channelId: r.id,
                deploymentId: r.deploymentId,
              })),
            );

          const environment = await createEnv(tx, {
            ...rest,
            metadata,
            versionChannels: channels,
          });

          await createJobsForNewEnvironment(tx, environment);
          return NextResponse.json({ ...environment, metadata });
        });
      } catch (error) {
        logger.error("Failed to create environment", { error });
        return NextResponse.json(
          { error: "Failed to create environment" },
          { status: 500 },
        );
      }
    },
  );

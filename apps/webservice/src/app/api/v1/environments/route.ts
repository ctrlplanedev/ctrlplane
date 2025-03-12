import type { PermissionChecker } from "@ctrlplane/auth/utils";
import type { User } from "@ctrlplane/db/schema";
import { NextResponse } from "next/server";
import httpStatus from "http-status";
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

const log = logger.child({ module: "api/v1/environments" });

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
          const { releaseChannels, metadata, ...rest } = ctx.body;

          const channels = await tx
            .select()
            .from(schema.releaseChannel)
            .where(inArray(schema.releaseChannel.id, releaseChannels))
            .then((rows) =>
              _.uniqBy(rows, (r) => r.deploymentId).map((r) => ({
                channelId: r.id,
                deploymentId: r.deploymentId,
              })),
            );

          const environment = await createEnv(tx, {
            ...rest,
            metadata,
            releaseChannels: channels,
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

export const GET = request()
    .use(authn)
    .use(
        authz(({ ctx, can }) =>
            can
                .perform(Permission.EnvironmentList)
                .on({ type: "workspace", id: ctx.body.workspaceId }),
        ),
    )
    .handle(async (ctx) =>
        ctx.db
            .select()
            .from(schema.environment)
            .orderBy(schema.environment.name)
            .then((environments) => ({ data: environments }))
            .then((paginated) =>
                NextResponse.json(paginated, { status: httpStatus.CREATED }),
            )
            .catch((error) => {
                if (error instanceof z.ZodError)
                    return NextResponse.json(
                        { error: error.errors },
                        { status: httpStatus.BAD_REQUEST },
                    );

                log.error("Error getting systems:", error);
                return NextResponse.json(
                    { error: "Internal Server Error" },
                    { status: httpStatus.INTERNAL_SERVER_ERROR },
                );
            }),
    );

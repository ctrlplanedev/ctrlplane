import { NextResponse } from "next/server";
import httpStatus from "http-status";
import _ from "lodash";
import { z } from "zod";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const log = logger.child({ module: "api/v1/workspaces/:workspaceId/systems" });

export const POST = request()
  .use(authn)
  .use(parseBody(schema.createSystem))
  .use(
    authz(({ ctx, can }) =>
      can
        .perform(Permission.SystemCreate)
        .on({ type: "workspace", id: ctx.body.workspaceId }),
    ),
  )
  .handle<{ body: z.infer<typeof schema.createSystem> }>(async (ctx) => {
    try {
      const existingSystem = await ctx.db
        .select()
        .from(schema.system)
        .where(
          and(
            eq(schema.system.workspaceId, ctx.body.workspaceId),
            eq(schema.system.slug, ctx.body.slug),
          ),
        )
        .then(takeFirstOrNull);

      if (existingSystem != null) {
        const updatedSystem = await ctx.db
          .update(schema.system)
          .set(ctx.body)
          .where(eq(schema.system.id, existingSystem.id))
          .returning()
          .then(takeFirst);

        await eventDispatcher.dispatchSystemUpdated(updatedSystem);

        return NextResponse.json(updatedSystem, { status: httpStatus.OK });
      }

      const newSystem = await ctx.db
        .insert(schema.system)
        .values(ctx.body)
        .returning()
        .then(takeFirst);

      await eventDispatcher.dispatchSystemCreated(newSystem);

      return NextResponse.json(newSystem, { status: httpStatus.CREATED });
    } catch (error) {
      if (error instanceof z.ZodError)
        return NextResponse.json(
          { error: error.errors },
          { status: httpStatus.BAD_REQUEST },
        );

      log.error("Error upserting system:", error);
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: httpStatus.INTERNAL_SERVER_ERROR },
      );
    }
  });

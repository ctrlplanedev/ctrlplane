import type * as schema from "@ctrlplane/db/schema";
import { NextResponse } from "next/server";
import { z } from "zod";
import httpStatus from "http-status";

import { db } from "@ctrlplane/db/client";
import {createResource, resource} from "@ctrlplane/db/schema";
import { upsertResources } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";
import {logger} from "@ctrlplane/logger";

const log = logger.child({ module: "api/v1/deployments" });

const patchBodySchema = z.object({
  workspaceId: z.string().uuid(),
  resources: z.array(
    createResource
      .omit({ lockedAt: true, providerId: true, workspaceId: true })
      .extend({
        metadata: z.record(z.string()).optional(),
        variables: z
          .array(
            z.object({
              key: z.string(),
              value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
              sensitive: z.boolean(),
            }),
          )
          .optional()
          .refine(
            (vars) =>
              vars == null ||
              new Set(vars.map((v) => v.key)).size === vars.length,
            "Duplicate variable keys are not allowed",
          ),
      }),
  ),
});

export const POST = request()
  .use(authn)
  .use(parseBody(patchBodySchema))
  .use(
    authz(({ can, ctx }) =>
      can
        .perform(Permission.ResourceUpdate)
        .on({ type: "workspace", id: ctx.body.workspaceId }),
    ),
  )
  .handle<{ user: schema.User; body: z.infer<typeof patchBodySchema> }>(
    async (ctx) => {
      if (ctx.body.resources.length === 0)
        return NextResponse.json(
          { error: "No resources provided" },
          { status: 400 },
        );

      const resources = await upsertResources(
        db,
        ctx.body.resources.map((t) => ({
          ...t,
          workspaceId: ctx.body.workspaceId,
        })),
      );

      return NextResponse.json({ count: resources.all.length });
    },
  );

export const GET = request()
    .use(authn)
    .use(
        authz(({ ctx, can }) =>
            can
                .perform(Permission.ResourceList)
                .on({ type: "workspace", id: ctx.body.workspaceId }),
        ),
    )
    .handle(async (ctx) =>
        ctx.db
            .select()
            .from(resource)
            .orderBy(resource.name)
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

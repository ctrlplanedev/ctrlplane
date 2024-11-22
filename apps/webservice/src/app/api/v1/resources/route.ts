import type * as schema from "@ctrlplane/db/schema";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@ctrlplane/db/client";
import { createResource } from "@ctrlplane/db/schema";
import { upsertResources } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

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
